// DB operations for the sync engine (features/sync/engine.ts) — the engine
// never touches Drizzle directly (docs/ARCHITECTURE.md §6). Push side: read the
// outbox FIFO, mark results. Pull side: upsert reference data + cursors.

import { db } from '@/db/client';
import {
	agentStock,
	appSettings,
	assignments,
	beneficiaries,
	bomItems,
	boms,
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
			tx.insert(posProfiles)
				.values(p)
				.onConflictDoUpdate({ target: posProfiles.id, set: p })
				.run();
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
		for (const row of tx
			.select({ id: posProfiles.id })
			.from(posProfiles)
			.all()) {
			if (!keep.has(row.id) && !referenced.has(row.id)) {
				tx.delete(posProfiles).where(eq(posProfiles.id, row.id)).run();
			}
		}
		for (const p of profiles) {
			tx.insert(posProfiles)
				.values(p)
				.onConflictDoUpdate({ target: posProfiles.id, set: p })
				.run();
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
		tx.delete(bomItems).run();
		tx.delete(agentStock).run();
		tx.delete(posSessions).run();
		tx.delete(vouchers).run();
		tx.delete(assignments).run();
		tx.delete(hampers).run();
		tx.delete(boms).run();
		tx.delete(beneficiaries).run();
		tx.delete(posProfiles).run();
		tx.delete(syncMeta).run();
		tx.delete(appSettings).run();
	});
}

// ---- push side --------------------------------------------------------------

// Anything left to push? Used by the shift-boundary preflight (opening/closing
// a session and signing out all demand a clean outbox).
export function pendingOutboxCount(): number {
	return db.select({ id: outbox.id }).from(outbox).all().length;
}

// Session references must leave the device as the POS Opening Entry's server
// name — the backend resolves them as document names.
//
// Redemptions already carry it: a shift only exists once its opening entry is on
// the server (openPosSession rolls back otherwise), so mutations stamp the name
// straight into the payload. Those pass through here untouched — the lookup is
// by local session id, which a server name never matches. This still runs for
// them to cover rows queued by an older build, and it is load-bearing for
// pos_closing, which references the shift by its local id.
//
// If a lookup finds nothing the local id goes out unchanged and the server
// rejects it rather than guessing.
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
				.where(
					or(
						eq(posSessions.id, ref),
						eq(posSessions.openingServerName, ref),
					),
				)
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

// Units still queued to leave each warehouse, keyed `warehouse item`.
//
// The outbox IS the set of mutations the server has not applied yet, so its
// goods_issue / stock_return / stock_damaged payloads are exactly the deductions
// the pulled Bin quantity cannot know about. Without this the server's on-hand
// would undo a local decrement whose push hasn't landed, and the agent would see
// stock they have already handed out — then watch it drop twice once it syncs.
function pendingStockDeductions(): Map<string, number> {
	const out = new Map<string, number>();
	for (const row of db
		.select({ payload: outbox.payload })
		.from(outbox)
		.all()) {
		let p: OutboxPayload;
		try {
			p = JSON.parse(row.payload) as OutboxPayload;
		} catch {
			continue;
		}
		if (p.kind !== 'goods_issue' && p.kind !== 'stock_return') continue;
		const { warehouse, hamper, qty } = p;
		if (!warehouse || !hamper || !qty) continue;
		const key = `${warehouse} ${hamper}`;
		out.set(key, (out.get(key) ?? 0) + qty);
	}
	return out;
}

// Upsert pulled reference data. Local pending work wins: vouchers referenced by
// still-pending local transactions are skipped this round — the server copy
// lands once the pending push resolves (ARCHITECTURE.md §4) — and pulled stock
// levels are reduced by whatever is still queued to leave the warehouse.
export function applyPull(pull: PullResponse): number {
	const pending = db
		.select({ voucherNo: posTransactions.voucherNo })
		.from(posTransactions)
		.where(eq(posTransactions.status, 'pending'))
		.all();
	const pendingVoucherNos = new Set(
		pending.map((p) => p.voucherNo).filter(Boolean),
	);
	const queuedOut = pendingStockDeductions();

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
				bomId: v.bomId ?? null,
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
				warehouse: v.warehouse,
				assignmentId: v.assignmentId ?? null,
				image: v.image ?? null,
			};
			tx.insert(vouchers)
				.values(row)
				.onConflictDoUpdate({ target: vouchers.id, set: row })
				.run();
			upserts++;
		}
		for (const b of pull.boms) {
			const row = {
				id: b.id,
				itemCode: b.itemCode,
				itemName: b.itemName,
				quantity: b.quantity,
				uom: b.uom ?? null,
			};
			tx.insert(boms)
				.values(row)
				.onConflictDoUpdate({ target: boms.id, set: row })
				.run();
			// Components are replaced wholesale — they have no local edits.
			tx.delete(bomItems).where(eq(bomItems.bomId, b.id)).run();
			if (b.items.length > 0) {
				tx.insert(bomItems)
					.values(b.items.map((i) => ({ bomId: b.id, ...i })))
					.run();
			}
			upserts++;
		}
		for (const b of pull.beneficiaries) {
			const row = {
				id: b.id,
				fullName: b.fullName,
				idNumber: b.idNumber ?? null,
				status: b.status ?? null,
				phone: b.phone ?? null,
				householdSize: b.householdSize,
				beneficiaryType: b.beneficiaryType ?? null,
				district: b.district ?? null,
			};
			tx.insert(beneficiaries)
				.values(row)
				.onConflictDoUpdate({ target: beneficiaries.id, set: row })
				.run();
			upserts++;
		}
		for (const h of pull.hampers) {
			tx.insert(hampers)
				.values({ id: h.id, name: h.name })
				.onConflictDoUpdate({
					target: hampers.id,
					set: { name: h.name },
				})
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
			// onHand comes from the server's Bin and is authoritative. issuedToday
			// and damaged are DEVICE-side day counters the backend has no notion of
			// (it always sends 0), so they are set on first insert only — updating
			// them here would reset the agent's running tallies on every sync.
			const onHand = Math.max(
				0,
				s.onHand - (queuedOut.get(`${s.warehouse} ${s.hamperId}`) ?? 0),
			);
			tx.insert(agentStock)
				.values({ ...s, bomId: s.bomId ?? null, onHand })
				.onConflictDoUpdate({
					target: [agentStock.warehouse, agentStock.hamperId],
					set: {
						hamperName: s.hamperName,
						bomId: s.bomId ?? null,
						onHand,
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
		// Settings are replaced wholesale: the server sends the full object on
		// every pull and the device never edits them. Anything the server has
		// stopped sending therefore disappears rather than lingering as a
		// stale override. useLiveQuery on app_settings re-renders every screen
		// reading useSettings() the moment this lands.
		tx.delete(appSettings).run();
		tx.insert(appSettings)
			.values(
				Object.entries(pull.settings).map(([key, value]) => ({
					key,
					value: JSON.stringify(value),
				})),
			)
			.run();
		upserts++;
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
