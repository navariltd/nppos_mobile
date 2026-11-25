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
import type {
	LedgerTransaction,
	OutboxPayload,
	PullCursors,
	PullResponse,
} from '@/services/api';
import type { PosProfile } from '@/types/domain';
import { and, asc, eq, isNull, lte, ne, or, sql } from 'drizzle-orm';

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

// ---- device owner (who the reference data belongs to) -----------------------

// sync_meta row naming the user the device's reference data + cursors were
// pulled for. Every user-owned row a mutation writes is stamped with it.
const OWNER_KEY = '__user';

export function deviceOwner(): string | null {
	return (
		db.select({ cursor: syncMeta.cursor }).from(syncMeta).where(eq(syncMeta.collection, OWNER_KEY)).get()
			?.cursor ?? null
	);
}

// Record who the device now belongs to. `claimLegacy` attributes rows written
// before rows carried a user (user IS NULL) to them — only safe when that user
// was demonstrably the one signed in when those rows were written (an upgrade
// with the session still open); otherwise they stay unowned and hidden.
export function claimDevice(user: string, claimLegacy = false): void {
	db.transaction((tx) => {
		tx.insert(syncMeta)
			.values({ collection: OWNER_KEY, cursor: user, lastPulledAt: null })
			.onConflictDoUpdate({ target: syncMeta.collection, set: { cursor: user } })
			.run();
		if (claimLegacy) {
			tx.update(posTransactions).set({ user }).where(isNull(posTransactions.user)).run();
			tx.update(posSessions).set({ user }).where(isNull(posSessions.user)).run();
			tx.update(voucherRedemptions).set({ user }).where(isNull(voucherRedemptions.user)).run();
		}
	});
}

// A different user is signing in: drop the warehouse/reference data pulled for
// the previous one and every pull cursor, so the next pull is a full one
// (bounded server-side to the history window) for THIS user's warehouses.
//
// Kept: user-owned rows (pos_transactions, voucher_redemptions, pos_sessions —
// filtered by user, not deleted), pos_profiles (login replaces them),
// app_settings (replaced every pull) and the outbox (sign-in refuses a
// different user while it is non-empty). Children before parents (FKs on).
export function resetReferenceData(): void {
	db.transaction((tx) => {
		tx.delete(agentStock).run();
		tx.delete(vouchers).run();
		tx.delete(beneficiaries).run();
		tx.delete(bomItems).run();
		tx.delete(boms).run();
		tx.delete(hamperItems).run();
		tx.delete(hampers).run();
		tx.delete(assignments).run();
		tx.delete(syncMeta).where(ne(syncMeta.collection, OWNER_KEY)).run();
	});
}

// ---- push side --------------------------------------------------------------

// Anything left to push? Used by the shift-boundary preflight (opening/closing
// a session and signing out all demand a clean outbox).
export function pendingOutboxCount(): number {
	return db.select({ id: outbox.id }).from(outbox).all().length;
}

// What is still queued, and why the oldest item last failed. The preflight
// refuses a shift boundary on the count alone; without the reason the agent is
// told to "clear it" with no way of knowing what is wrong, and the error only
// exists in the outbox row nobody can see.
export function pendingOutboxSummary(): { count: number; lastError?: string } {
	const rows = db
		.select({ lastError: outbox.lastError })
		.from(outbox)
		.orderBy(asc(outbox.createdAt))
		.all();
	const firstError = rows.find((r) => !!r.lastError)?.lastError;
	return { count: rows.length, lastError: firstError ?? undefined };
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
//
// `includeBackedOff` ignores the backoff and takes everything queued. Backoff
// exists to stop BACKGROUND triggers from hammering a server that just failed;
// it must never sit between the agent and their own work. A person who taps
// "Sync now", or who is trying to close a shift (both of which refuse to
// proceed while the outbox is non-empty), is asking for exactly this item to go
// now — making them wait out a timer they cannot see is a dead end.
export function getOutboxBatch(limit = 50, includeBackedOff = false): OutboxItem[] {
	const now = nowIso();
	const due = or(isNull(outbox.nextRetryAt), lte(outbox.nextRetryAt, now));
	return db
		.select()
		.from(outbox)
		.where(includeBackedOff ? undefined : due)
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

// The server recorded the push in its POS Sync Ledger but could not post it:
//  - 'needs_review' → local 'conflict': parked for an admin in the desk;
//  - 'rejected'     → local 'rejected': an admin already rejected it (final).
// Either way it leaves the queue — never auto-retried, never deleted. The
// admin's later decision arrives through applyPull (pull.transactions).
// Session opens/closes have no pos_transactions row; their ledger row in the
// desk is the record (a refused opening is rolled back by PosSessionCard).
export function markPushRejected(
	item: OutboxItem,
	outcome: 'needs_review' | 'rejected',
	reason: string,
	ledger?: string,
): void {
	db.transaction((tx) => {
		if (outcome === 'rejected') undoRejectedIssue(tx, item.id);
		tx.update(posTransactions)
			.set(
				outcome === 'rejected'
					? { status: 'rejected', resolutionNote: reason, ledgerName: ledger ?? item.id }
					: { status: 'conflict', conflictReason: reason, ledgerName: ledger ?? item.id },
			)
			.where(eq(posTransactions.id, item.id))
			.run();
		tx.delete(outbox).where(eq(outbox.id, item.id)).run();
	});
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A goods issue that ends up REJECTED never happened as far as the ledger is
// concerned — no Stock Entry was posted. The pulled on-hand already reflects
// that (the Bin never moved), but `issued_today` is a device-side tally the
// pull never overwrites, so take the issue back out of it here. Call BEFORE the
// row's status flips to 'rejected': it only acts on a row that isn't rejected
// yet, which is what makes it run once per transaction.
function undoRejectedIssue(tx: Tx, transactionId: string, alreadyRejected = false): void {
	const t = tx
		.select({
			status: posTransactions.status,
			type: posTransactions.type,
			qty: posTransactions.qty,
			voucherNo: posTransactions.voucherNo,
			warehouse: posTransactions.warehouse,
		})
		.from(posTransactions)
		.where(eq(posTransactions.id, transactionId))
		.get();
	if (!t || t.type !== 'goods_issue' || !t.qty || !t.warehouse) return;
	if (t.status === 'rejected' && !alreadyRejected) return;
	const hamperId = t.voucherNo
		? tx
				.select({ hamperId: vouchers.hamperId })
				.from(vouchers)
				.where(eq(vouchers.voucherNo, t.voucherNo))
				.get()?.hamperId
		: undefined;
	if (!hamperId) return;
	tx.update(agentStock)
		.set({ issuedToday: sql`max(0, ${agentStock.issuedToday} - ${t.qty})` })
		.where(and(eq(agentStock.warehouse, t.warehouse), eq(agentStock.hamperId, hamperId)))
		.run();
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

// sync_meta rows whose name starts with this are device bookkeeping (OWNER_KEY),
// not pull cursors — never sent to the server.
const META_PREFIX = '__';

// One-off re-pulls for data the server only started sending later. A delta pull
// never re-sends an unchanged row, so a new field would stay empty on the device
// for every voucher that doesn't happen to change. Each entry drops the listed
// cursors once (marker row in sync_meta) so the next pull sends the full,
// bounded set. Done in code rather than in a migration: a migration can be
// applied by Metro's reload the moment drizzle-kit writes it, before its SQL is
// finished, and is then never re-run.
const BACKFILLS: { key: string; cursors: string[]; run?: (tx: Tx) => void }[] = [
	// Assigned agent on vouchers — the "assigned to another agent" guard.
	{ key: `${'__'}backfill_voucher_agent`, cursors: ['vouchers', 'warehouses'] },
	// Unredeemed EXPIRED vouchers of any age are now part of the full set, so a
	// scan says "expired on …" instead of "not found".
	{ key: `${'__'}backfill_expired_vouchers`, cursors: ['vouchers', 'warehouses'] },
	// Goods issues rejected BEFORE undoRejectedIssue existed were never taken
	// back out of issued_today — do it once for every one of them.
	{
		key: `${'__'}backfill_rejected_issue_tally`,
		cursors: [],
		run: (tx) => {
			for (const r of tx
				.select({ id: posTransactions.id })
				.from(posTransactions)
				.where(and(eq(posTransactions.status, 'rejected'), eq(posTransactions.type, 'goods_issue')))
				.all()) {
				undoRejectedIssue(tx, r.id, true);
			}
		},
	},
];

export function runPullBackfills(): void {
	for (const b of BACKFILLS) {
		const done = db
			.select({ c: syncMeta.collection })
			.from(syncMeta)
			.where(eq(syncMeta.collection, b.key))
			.get();
		if (done) continue;
		db.transaction((tx) => {
			for (const c of b.cursors) tx.delete(syncMeta).where(eq(syncMeta.collection, c)).run();
			b.run?.(tx);
			tx.insert(syncMeta).values({ collection: b.key, cursor: nowIso(), lastPulledAt: null }).run();
		});
	}
}

export function getPullCursors(): PullCursors {
	const rows = db.select().from(syncMeta).all();
	const cursors: Record<string, string> = {};
	for (const r of rows) {
		if (r.cursor && !r.collection.startsWith(META_PREFIX)) cursors[r.collection] = r.cursor;
	}
	return cursors as PullCursors;
}

// ---- ledger reconciliation (pull.transactions) ------------------------------

const LEDGER_KINDS = new Set(['cash_payment', 'goods_issue', 'stock_return']);

// A ledger row for a transaction this device no longer has (wiped by a
// reset, or recorded on another device) — rebuilt so the agent's recent
// history and its needs-review state survive. Titles mirror mutations.ts.
function rebuiltTransaction(t: LedgerTransaction, user: string | null) {
	const voucher = t.voucherNo
		? db.select().from(vouchers).where(eq(vouchers.voucherNo, t.voucherNo)).get()
		: undefined;
	const hamperId = t.hamper ?? voucher?.hamperId ?? undefined;
	const hamper = hamperId
		? db.select({ name: hampers.name }).from(hampers).where(eq(hampers.id, hamperId)).get()
		: undefined;
	const recipient = voucher?.beneficiaryNo
		? `${voucher.beneficiaryNo} · ${t.voucherNo}`
		: `Voucher ${t.voucherNo ?? ''}`.trim();
	const kind = t.kind as 'cash_payment' | 'goods_issue' | 'stock_return';
	return {
		id: t.clientRef,
		type: kind,
		title:
			kind === 'cash_payment'
				? 'Cash payout'
				: (hamper?.name ?? hamperId ?? 'Hamper'),
		subtitle:
			kind === 'stock_return' ? `Returned ${t.qty ?? 0} to central warehouse` : recipient,
		amount: kind === 'cash_payment' ? (t.amount ?? null) : null,
		qty: kind === 'cash_payment' ? null : (t.qty ?? null),
		voucherNo: t.voucherNo ?? null,
		warehouse: t.warehouse ?? null,
		project: t.project ?? voucher?.project ?? '',
		assignmentId: voucher?.assignmentId ?? null,
		createdAt: t.createdAt ? toIso(t.createdAt) : nowIso(),
		user,
	};
}

// Server datetimes arrive as 'YYYY-MM-DD HH:MM:SS' (UTC wall time — that is
// how the device sent them). Normalise to ISO so list sorting stays consistent.
function toIso(value: string): string {
	return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

// The ledger's verdict as local columns.
function ledgerState(t: LedgerTransaction) {
	const decision = {
		ledgerName: t.clientRef,
		resolution: t.resolution ?? null,
		resolutionNote: t.resolutionNote ?? null,
		resolvedBy: t.resolvedBy ?? null,
		resolvedAt: t.resolvedAt ? toIso(t.resolvedAt) : null,
	};
	switch (t.status) {
		case 'synced':
			return {
				...decision,
				status: 'synced' as const,
				serverName: t.serverName ?? null,
				syncedAt: nowIso(),
				conflictReason: null,
			};
		case 'rejected':
			return { ...decision, status: 'rejected' as const };
		case 'needs_review':
			return {
				...decision,
				status: 'conflict' as const,
				conflictReason: t.reason ?? 'Waiting for admin review.',
			};
		default:
			return null; // 'pending': the server will settle it; nothing to say yet
	}
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
//
// `user` is who the pull was made for (the signed-in login email) — stamped on
// any transaction rebuilt from the ledger.
export function applyPull(pull: PullResponse, user: string | null = null): number {
	const pending = db
		.select({ voucherNo: posTransactions.voucherNo })
		.from(posTransactions)
		.where(eq(posTransactions.status, 'pending'))
		.all();
	const pendingVoucherNos = new Set(
		pending.map((p) => p.voucherNo).filter(Boolean),
	);
	const queuedOut = pendingStockDeductions();
	const queuedIds = new Set(
		db
			.select({ id: outbox.id })
			.from(outbox)
			.all()
			.map((r) => r.id),
	);

	// Parents a pulled row may reference: what is already on the device plus
	// what this pull brings. FK checks are deferred to COMMIT, so ONE dangling
	// reference would fail the entire pull with an opaque "Failed query:
	// commit" and leave the agent unable to sync at all. A reference the server
	// didn't send is dropped from that row instead (logged), and the rest of the
	// pull lands; the next pull that carries the parent fills it back in.
	const known = {
		assignments: new Set([
			...db.select({ id: assignments.id }).from(assignments).all().map((r) => r.id),
			...pull.assignments.map((a) => a.id),
		]),
		hampers: new Set([
			...db.select({ id: hampers.id }).from(hampers).all().map((r) => r.id),
			...pull.hampers.map((h) => h.id),
		]),
		boms: new Set([
			...db.select({ id: boms.id }).from(boms).all().map((r) => r.id),
			...pull.boms.map((b) => b.id),
		]),
	};
	const dangling: string[] = [];
	const ref = (kind: keyof typeof known, id: string | null | undefined, owner: string) => {
		if (!id) return null;
		if (known[kind].has(id)) return id;
		dangling.push(`${owner} → ${kind} ${id}`);
		return null;
	};

	let upserts = 0;
	try {
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
					hamperId: ref('hampers', v.hamperId, `voucher ${v.id}`),
					bomId: ref('boms', v.bomId, `voucher ${v.id}`),
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
					agentId: v.agentId ?? null,
					agentName: v.agentName ?? null,
					agentUser: v.agentUser ?? null,
					assignmentId: ref('assignments', v.assignmentId, `voucher ${v.id}`),
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
				// hamper_id is part of the key — a row for an item never sent as a
				// hamper can't be stored at all, so it waits for a pull that has it.
				if (!ref('hampers', s.hamperId, `stock ${s.warehouse}`)) continue;
				const bomId = ref('boms', s.bomId, `stock ${s.warehouse} ${s.hamperId}`);
				const onHand = Math.max(
					0,
					s.onHand - (queuedOut.get(`${s.warehouse} ${s.hamperId}`) ?? 0),
				);
				tx.insert(agentStock)
					.values({ ...s, bomId, onHand })
					.onConflictDoUpdate({
						target: [agentStock.warehouse, agentStock.hamperId],
						set: {
							hamperName: s.hamperName,
							bomId,
							onHand,
						},
					})
					.run();
				upserts++;
			}
			// Ledger verdicts. Still-queued local work wins (it hasn't been pushed, so
			// the ledger can't know its latest state); everything else takes the
			// server's word — that is how an admin's Retry / Force post / Reject
			// reaches the agent.
			for (const t of pull.transactions ?? []) {
				if (!LEDGER_KINDS.has(t.kind) || queuedIds.has(t.clientRef)) continue;
				const state = ledgerState(t);
				if (!state) continue;
				const local = tx
					.select({ id: posTransactions.id })
					.from(posTransactions)
					.where(eq(posTransactions.id, t.clientRef))
					.get();
				if (local) {
					// Rejected in the desk → take a goods issue back out of today's
					// tally (no-op if this row was already rejected).
					if (state.status === 'rejected') undoRejectedIssue(tx, t.clientRef);
					tx.update(posTransactions).set(state).where(eq(posTransactions.id, t.clientRef)).run();
				} else {
					tx.insert(posTransactions)
						.values({ ...rebuiltTransaction(t, user), ...state })
						.run();
				}
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
	} catch (e) {
		// Drizzle reports a failed COMMIT as "Failed query: commit" — the real
		// SQLite error (e.g. FOREIGN KEY constraint failed) is on `cause`.
		const cause = (e as { cause?: { message?: string } })?.cause?.message;
		console.warn('[sync] applyPull failed', e, cause);
		throw new Error(
			`Could not save the pulled data${cause ? ` (${cause})` : ''}. Try again; if it persists, report it.`,
		);
	}
	if (dangling.length > 0) {
		console.warn(`[sync] pull referenced ${dangling.length} missing parent row(s) — links dropped:`, dangling);
	}
	return upserts;
}
