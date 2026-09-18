// Shift-boundary preflight: the gate in front of opening a POS session,
// closing one, and signing out.
//
// Everyday distribution work stays offline-first (AGENTS.md rule 2), but the
// boundaries of a shift are different — they have to agree with the backend:
//
// - Opening reads the world: the agent's vouchers, entitlements and stock must
//   be current before the first redemption, and nothing from a previous shift
//   may still be queued (a stale push landing mid-shift would move the numbers
//   the reconciliation is about to be based on).
// - Closing writes the world: the POS Closing Entry's expected-cash figure is
//   only true if every transaction it counts has already reached the server.
// - Signing out closes any open shift, so it inherits the same requirement.
//
// So all three demand connectivity, a full outbox flush, a fresh pull, and an
// empty queue afterwards. Anything left pending means something was refused or
// the link died mid-flush — either way the agent stays where they are.
//
// The flush is FORCED: a queued item still inside its retry backoff is pushed
// now rather than after the timer. Backoff is there to pace background retries,
// and honouring it here would leave an agent unable to close their shift for up
// to ten minutes with nothing on screen explaining the wait.

import { pendingOutboxSummary } from '@/repositories';
import type { AppDispatch } from '@/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import * as React from 'react';
import { syncNow, type SyncResult } from './engine';
import { selectIsOnline } from './slice';

export type PreflightResult = { ok: true } | { ok: false; reason: string };

const RETRY_DELAY_MS = 700;
const MAX_ATTEMPTS = 4;

/**
 * Run a sync and wait for it, even if one of SyncManager's background triggers
 * got there first. syncNow refuses to overlap (its `condition`), and that
 * refusal arrives as a ConditionError — which is NOT a failure, just "someone
 * else is already doing it". Retry until the in-flight run clears; any real
 * error (offline, transport, server) is thrown to the caller.
 *
 * Forces the outbox by default: every caller here is a person waiting on the
 * queue to empty, so an item still inside its retry backoff must be attempted
 * now rather than blocking the shift boundary until a timer nobody can see
 * expires. Pass `false` for a flush that should respect the backoff.
 */
export async function flushNow(dispatch: AppDispatch, force = true): Promise<SyncResult> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await dispatch(syncNow({ force })).unwrap();
		} catch (e) {
			const skipped = (e as { name?: string })?.name === 'ConditionError';
			if (!skipped || attempt >= MAX_ATTEMPTS) throw e;
			await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
		}
	}
}

/**
 * Flush + pull, and report whether the device is now level with the backend.
 * `action` names what the agent was trying to do, for the failure message.
 */
export async function runShiftPreflight(
	dispatch: AppDispatch,
	isOnline: boolean,
	action: string,
): Promise<PreflightResult> {
	if (!isOnline) {
		return { ok: false, reason: `You need to be online to ${action}.` };
	}

	try {
		await flushNow(dispatch);
	} catch (e) {
		const message = (e as { message?: string })?.message;
		return {
			ok: false,
			reason: message
				? `Sync did not finish — ${message} Try again once you have a stable connection.`
				: 'Sync did not finish. Try again once you have a stable connection.',
		};
	}

	// The flush above forced every queued item, backoff included, so anything
	// still here was just attempted and failed again — say what went wrong
	// rather than leaving the agent to guess at an invisible queue.
	const { count, lastError } = pendingOutboxSummary();
	if (count > 0) {
		const what = `${count} transaction${count === 1 ? '' : 's'} still waiting to sync`;
		return {
			ok: false,
			reason: lastError
				? `${what} — ${lastError} Clear ${count === 1 ? 'it' : 'them'} before you ${action}.`
				: `${what}. Clear ${count === 1 ? 'it' : 'them'} before you ${action}.`,
		};
	}
	return { ok: true };
}

/**
 * Screen-side wrapper: `run(action)` performs the preflight, `isRunning` drives
 * the busy state on whatever button triggered it.
 */
export function useShiftPreflight() {
	const dispatch = useAppDispatch();
	const isOnline = useAppSelector(selectIsOnline);
	const [isRunning, setIsRunning] = React.useState(false);

	const run = React.useCallback(
		async (action: string): Promise<PreflightResult> => {
			setIsRunning(true);
			try {
				return await runShiftPreflight(dispatch, isOnline, action);
			} finally {
				setIsRunning(false);
			}
		},
		[dispatch, isOnline],
	);

	return { run, isRunning, isOnline };
}
