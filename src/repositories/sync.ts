// DB operations for the sync engine (features/sync/engine.ts) — the engine
// never touches Drizzle directly (docs/ARCHITECTURE.md §6). Push side: read the
// outbox FIFO, mark results. Pull side: upsert reference data + cursors.

import { db } from '@/db/client';
import {
	agentStock,
	assignments,
	hamperItems,
	hampers,
	outbox,
	posProfiles,
	posSessions,
	posTransactions,
	syncMeta,
	voucherRedemptions,
	vouchers,
} from '@/db/schema';
import type { OutboxPayload, PullCursors, PullResponse } from '@/services/api';
import type { PosProfile } from '@/types/domain';
import { asc, eq, isNull, lte, or, sql } from 'drizzle-orm';

export interface OutboxItem {
	id: string;
	payload: OutboxPayload;
	attemptCount: number;
	createdAt: string;
}

function nowIso(): string {
	return new Date().toISOString();
}

// ---- POS profiles (fed by login, then kept fresh by pull) -------------------

// Upsert the user's POS profiles. applyPull calls this to keep the set fresh on
// each delta pull (it never removes — that's the pull contract).
export function upsertPosProfiles(profiles: PosProfile[]): void {
	if (profiles.length === 0) return;
	db.transaction((tx) => {
		for (const p of profiles) {
			tx.insert(posProfiles).values(p).onConflictDoUpdate({ target: posProfiles.id, set: p }).run();
		}
	});
}

// Reconcile local POS profiles to exactly what login returned for this user —
// so stale rows (seed data, or a profile no longer applicable to the agent)
// disappear, and an empty list clears the picker. Login is authoritative for
// the user's profile set. Rows still referenced by a local pos_session are kept
// (the FK would block deletion, and an in-flight session must not be orphaned).
export function replacePosProfiles(profiles: PosProfile[]): void {
	db.transaction((tx) => {
		const keep = new Set(profiles.map((p) => p.id));
		const referenced = new Set(
			tx
				.select({ id: posSessions.posProfileId })
				.from(posSessions)
				.all()
				.map((r) => r.id),
		);
		for (const row of tx.select({ id: posProfiles.id }).from(posProfiles).all()) {
			if (!keep.has(row.id) && !referenced.has(row.id)) {
				tx.delete(posProfiles).where(eq(posProfiles.id, row.id)).run();
			}
		}
		for (const p of profiles) {
			tx.insert(posProfiles).values(p).onConflictDoUpdate({ target: posProfiles.id, set: p }).run();
		}
	});
}

// Wipe ALL local data — every domain table, the outbox, and the pull cursors —
// so the next login + pull rebuilds SQLite purely from the backend. Deletes in
// FK-dependency order (children before parents) since foreign_keys = ON.
// Destructive: unsynced outbox work is dropped. Triggered once via
// EXPO_PUBLIC_RESET_DB (see src/db/provider.tsx).
export function resetLocalData(): void {
	db.transaction((tx) => {
		tx.delete(voucherRedemptions).run();
		tx.delete(posTransactions).run();
		tx.delete(outbox).run();
		tx.delete(hamperItems).run();
		tx.delete(agentStock).run();
		tx.delete(posSessions).run();
		tx.delete(vouchers).run();
		tx.delete(assignments).run();
		tx.delete(hampers).run();
		tx.delete(posProfiles).run();
		tx.delete(syncMeta).run();
	});
}

// ---- push side --------------------------------------------------------------

// Anything left to push? Used by the shift-boundary preflight (opening/closing
// a session and signing out all demand a clean outbox).
export function pendingOutboxCount(): number {
	return db.select({ id: outbox.id }).from(outbox).all().length;
}

// Session references are stored as the LOCAL session id (that's all a mutation
// knows) but must leave the device as the POS Opening Entry's server name — the
// backend resolves them as document names. Shifts are opened online and pushed
// immediately, so the name is always there by the time anything references it;
// if it somehow isn't, the local id goes out unchanged and the server rejects
// it rather than guessing.
function serverSessionName(localId: string): string | undefined {
	const row = db
		.select({ serverName: posSessions.openingServerName })
		.from(posSessions)
		.where(eq(posSessions.id, localId))
		.get();
	return row?.serverName ?? undefined;
}

function resolveSessionRefs(payload: OutboxPayload): OutboxPayload {
	if (payload.kind === 'pos_closing') {
		const serverName = serverSessionName(payload.session);
		return serverName ? { ...payload, session: serverName } : payload;
	}
	if (payload.kind === 'cash_payment' || payload.kind === 'goods_issue') {
		const serverName = serverSessionName(payload.posSession);
		return serverName ? { ...payload, posSession: serverName } : payload;
	}
	return payload;
}

// FIFO batch of items due for a push (never-retried or past their backoff).
export function getOutboxBatch(limit = 50): OutboxItem[] {
	const now = nowIso();
	return db
		.select()
		.from(outbox)
		.where(or(isNull(outbox.nextRetryAt), lte(outbox.nextRetryAt, now)))
		.orderBy(asc(outbox.createdAt))
		.limit(limit)
		.all()
		.map((r) => ({
			id: r.id,
			payload: resolveSessionRefs(JSON.parse(r.payload) as OutboxPayload),
			attemptCount: r.attemptCount,
			createdAt: r.createdAt,
		}));
}

// Accepted push: stamp the server doc name and clear the queue row. POS
// session opens/closes carry their server names on the session row instead.
export function markPushAccepted(item: OutboxItem, serverName: string): void {
	db.transaction((tx) => {
		if (item.payload.kind === 'pos_opening') {
			// outbox id == session id (written at open)
			tx.update(posSessions)
				.set({ openingServerName: serverName })
				.where(eq(posSessions.id, item.id))
				.run();
		} else if (item.payload.kind === 'pos_closing') {
			// `session` left the device as the POS Opening Entry's server name
			// (resolveSessionRefs) but the row is keyed by the local session id —
			// match either form.
			const ref = item.payload.session;
			tx.update(posSessions)
				.set({ closingServerName: serverName })
				.where(or(eq(posSessions.id, ref), eq(posSessions.openingServerName, ref)))
				.run();
		}
		// Most kinds also have a matching pos_transactions row (same id).
		tx.update(posTransactions)
			.set({ status: 'synced', syncedAt: nowIso(), serverName })
			.where(eq(posTransactions.id, item.id))
			.run();
		tx.delete(outbox).where(eq(outbox.id, item.id)).run();
	});
}

// Valid server rejection: transaction goes to 'conflict' (admin resolves,
// online) and leaves the queue — it is never auto-retried, never deleted.
export function markPushRejected(item: OutboxItem, reason: string): void {
	db.transaction((tx) => {
		tx.update(posTransactions)
			.set({ status: 'conflict', conflictReason: reason })
			.where(eq(posTransactions.id, item.id))
			.run();
		tx.delete(outbox).where(eq(outbox.id, item.id)).run();
	});
}

// Transport/server failure: exponential backoff (5s · 2^attempt, capped 10min).
export function markPushFailed(item: OutboxItem, error: string): void {
	const delayMs = Math.min(5_000 * 2 ** item.attemptCount, 600_000);
	const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
	db.update(outbox)
		.set({
			attemptCount: item.attemptCount + 1,
			nextRetryAt,
			lastError: error,
		})
		.where(eq(outbox.id, item.id))
		.run();
}

// ---- pull side --------------------------------------------------------------

export function getPullCursors(): PullCursors {
	const rows = db.select().from(syncMeta).all();
	const cursors: Record<string, string> = {};
	for (const r of rows) if (r.cursor) cursors[r.collection] = r.cursor;
	return cursors as PullCursors;
}

// Upsert pulled reference data. Local pending work wins: vouchers referenced by
// still-pending local transactions are skipped this round — the server copy
// lands once the pending push resolves (ARCHITECTURE.md §4).
export function applyPull(pull: PullResponse): number {
	const pending = db
		.select({ voucherNo: posTransactions.voucherNo })
		.from(posTransactions)
		.where(eq(posTransactions.status, 'pending'))
		.all();
	const pendingVoucherNos = new Set(pending.map((p) => p.voucherNo).filter(Boolean));

	let upserts = 0;
	db.transaction((tx) => {
		// Defer FK checks to COMMIT so interdependent rows can be upserted in any
		// order — e.g. a goods voucher references a hamper that's inserted later
		// in the same batch (foreign_keys = ON in client.ts would otherwise throw
		// mid-transaction and roll back the whole pull). Auto-resets at commit.
		tx.run(sql`PRAGMA defer_foreign_keys = ON`);

		for (const a of pull.assignments) {
			const row = {
				id: a.id,
				agentId: a.agentId,
				project: a.project,
				disbursementOrder: a.disbursementOrder ?? null,
				date: a.date ?? null,
				amountToDisburse: a.amountToDisburse,
			};
			tx.insert(assignments)
				.values(row)
				.onConflictDoUpdate({ target: assignments.id, set: row })
				.run();
			upserts++;
		}
		for (const v of pull.vouchers) {
			if (pendingVoucherNos.has(v.voucherNo)) continue;
			const row = {
				id: v.id,
				voucherNo: v.voucherNo,
				beneficiaryNo: v.beneficiaryNo ?? null,
				entitlementType: v.entitlementType,
				amount: v.amount,
				hamperId: v.hamperId ?? null,
				qty: v.qty ?? null,
				uom: v.uom ?? null,
				rate: v.rate ?? null,
				redeemedAmount: v.redeemedAmount,
				redeemedQty: v.redeemedQty,
				validFrom: v.validFrom,
				validTo: v.validTo,
				status: v.status,
				usesCount: v.usesCount,
				maxUses: v.maxUses,
				project: v.project,
				assignmentId: v.assignmentId ?? null,
				image: v.image ?? null,
			};
			tx.insert(vouchers)
				.values(row)
				.onConflictDoUpdate({ target: vouchers.id, set: row })
				.run();
			upserts++;
		}
		for (const h of pull.hampers) {
			tx.insert(hampers)
				.values({ id: h.id, name: h.name })
				.onConflictDoUpdate({ target: hampers.id, set: { name: h.name } })
				.run();
			// Component list is replaced wholesale — it has no local edits.
			tx.delete(hamperItems).where(eq(hamperItems.hamperId, h.id)).run();
			if (h.items.length > 0) {
				tx.insert(hamperItems)
					.values(h.items.map((i) => ({ hamperId: h.id, ...i })))
					.run();
			}
			upserts++;
		}
		for (const s of pull.agentStock) {
			tx.insert(agentStock)
				.values(s)
				.onConflictDoUpdate({
					target: [agentStock.warehouse, agentStock.hamperId],
					set: {
						hamperName: s.hamperName,
						onHand: s.onHand,
						issuedToday: s.issuedToday,
						damaged: s.damaged,
					},
				})
				.run();
			upserts++;
		}
		for (const p of pull.posProfiles) {
			tx.insert(posProfiles)
				.values(p)
				.onConflictDoUpdate({ target: posProfiles.id, set: p })
				.run();
			upserts++;
		}
		for (const [collection, cursor] of Object.entries(pull.cursors)) {
			tx.insert(syncMeta)
				.values({ collection, cursor, lastPulledAt: nowIso() })
				.onConflictDoUpdate({
					target: syncMeta.collection,
					set: { cursor, lastPulledAt: nowIso() },
				})
				.run();
		}
	});
	return upserts;
}
