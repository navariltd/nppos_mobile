// The outbox sync engine (docs/ARCHITECTURE.md §4). One entry point: the
// syncNow thunk — push the outbox FIFO through the ApiAdapter, then delta-pull
// reference data. Triggers live in SyncManager.tsx (online transition, app
// foreground, interval, manual "Sync now").
//
// Outcome handling per item:
// - accepted  → transaction 'synced' + server doc name, queue row cleared
// - rejected  → transaction 'conflict' + reason (admin resolves, online-only),
//               queue row cleared, never auto-retried
// - throw     → attempt++/backoff on the item and the flush STOPS — FIFO order
//               is preserved so dependent records never leapfrog a failure.
//
// That backoff paces the BACKGROUND triggers only. A user-initiated sync passes
// { force: true } and retries everything queued immediately, because the person
// asking is the one being blocked by the wait (closing a shift and signing out
// both require an empty outbox).

import {
	applyPull,
	getOutboxBatch,
	getPullCursors,
	getSettings,
	markPushAccepted,
	markPushFailed,
	markPushRejected,
	pruneSyncedTransactions,
	type OutboxItem,
} from '@/repositories';
import { getApi } from '@/services/api';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { selectIsOnline, syncFailed, syncFinished, syncStarted, type SyncState } from './slice';

export interface SyncResult {
	pushed: number;
	conflicts: number;
	pulled: number;
}

type StateWithSync = { sync: SyncState };

function errorMessage(e: unknown): string {
	return (e as { message?: string })?.message || 'Sync failed.';
}

export interface SyncOptions {
	// Retry every queued item now, ignoring the backoff a previous failure set.
	// For user-initiated syncs only (the "Sync now" button, shift boundaries) —
	// background triggers must keep honouring the backoff.
	force?: boolean;
}

export const syncNow = createAsyncThunk<SyncResult, SyncOptions | void>(
	'sync/syncNow',
	async (options, { dispatch, getState }) => {
		if (!selectIsOnline(getState() as StateWithSync)) {
			throw new Error('Offline — cannot sync.');
		}
		const force = !!options?.force;
		dispatch(syncStarted());
		try {
			const api = getApi();
			let pushed = 0;
			let conflicts = 0;

			// ---- push (outbox FIFO) ----
			flush: while (true) {
				const batch = getOutboxBatch(50, force);
				if (batch.length === 0) break;
				for (const item of batch) {
					try {
						const result = await api.push(toPushItem(item));
						if (result.outcome === 'accepted') {
							markPushAccepted(item, result.serverName);
							pushed++;
						} else {
							markPushRejected(item, result.reason);
							conflicts++;
						}
					} catch (e) {
						// Transport/server failure — back off and stop the flush
						// so later (possibly dependent) items keep their order.
						markPushFailed(item, errorMessage(e));
						break flush;
					}
				}
			}

			// ---- pull (reference-data delta) ----
			const pulled = applyPull(await api.pull(getPullCursors()));

			// ---- retention (settings just landed with the pull) ----
			// Everything still queued was pushed above, so anything now marked
			// 'synced' is safe to age out. Never fails the sync.
			pruneSyncedTransactions(getSettings().transactionRetention);

			dispatch(syncFinished({ at: new Date().toISOString() }));
			return { pushed, conflicts, pulled };
		} catch (e) {
			dispatch(syncFailed({ error: errorMessage(e) }));
			throw e;
		}
	},
	{
		// Never overlap two runs — triggers can fire together (foreground +
		// online transition); the loser is silently skipped.
		condition: (_, { getState }) => !(getState() as StateWithSync).sync.isSyncing,
	},
);

function toPushItem(item: OutboxItem) {
	return {
		id: item.id,
		payload: item.payload,
		createdAt: item.createdAt,
		attempt: item.attemptCount,
	};
}
