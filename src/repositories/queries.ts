// All reactive reads. Screens use these hooks — never Drizzle directly
// (docs/ARCHITECTURE.md §6). Every hook is a useLiveQuery over the local DB, so
// any mutation (see mutations.ts) re-renders consumers automatically.

import { db } from '@/db/client';
import {
	agentStock,
	assignments,
	hamperItems,
	hampers,
	posProfiles,
	posSessions,
	posTransactions,
	voucherRedemptions,
	vouchers,
} from '@/db/schema';
import type {
	AgentStockRow,
	Assignment,
	Hamper,
	PosProfile,
	PosSession,
	PosTransaction,
	SyncStatus,
	Voucher,
	VoucherRedemption,
} from '@/types/domain';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { toAssignment, toPosSession, toTransaction, toVoucher, toVoucherRedemption } from './mappers';

// Sentinel for "no id yet" params so hooks can run unconditionally.
const NONE = '__none__';

// ---- assignments (ADA) ------------------------------------------------------

// The agent's assignments — the agent-scoped grouping vouchers belong to.
export function useAssignments(): Assignment[] {
	const { data } = useLiveQuery(db.select().from(assignments).orderBy(desc(assignments.date)));
	return (data ?? []).map(toAssignment);
}

export function useAssignment(id?: string): Assignment | undefined {
	const { data } = useLiveQuery(
		db.select().from(assignments).where(eq(assignments.id, id ?? NONE)),
		[id],
	);
	return data?.[0] ? toAssignment(data[0]) : undefined;
}

// The active assignment used to stamp accounting refs on ad-hoc transactions
// (e.g. stock moves). Imperative — callers read it inside a mutation.
export function firstAssignment(): Assignment | undefined {
	const rows = db.select().from(assignments).limit(1).all();
	return rows[0] ? toAssignment(rows[0]) : undefined;
}

// ---- vouchers ----------------------------------------------------------------

export function useVoucherByNo(voucherNo?: string): Voucher | undefined {
	const { data } = useLiveQuery(
		db.select().from(vouchers).where(eq(vouchers.voucherNo, voucherNo ?? NONE)),
		[voucherNo],
	);
	return data?.[0] ? toVoucher(data[0]) : undefined;
}

export function useVoucher(id?: string): Voucher | undefined {
	const { data } = useLiveQuery(
		db.select().from(vouchers).where(eq(vouchers.id, id ?? NONE)),
		[id],
	);
	return data?.[0] ? toVoucher(data[0]) : undefined;
}

// Live (reactive) search — results update when a redemption changes a voucher's
// status/uses, so the search list never goes stale after paying. Case-insensitive
// exact match (the backend doesn't guarantee uppercase voucher numbers). An empty
// query matches nothing (WHERE 1=0) so the hooks can run unconditionally.
export function useVoucherSearchByNo(voucherNo?: string): Voucher | undefined {
	const q = (voucherNo ?? '').trim().toUpperCase();
	const { data } = useLiveQuery(
		db
			.select()
			.from(vouchers)
			.where(q ? sql`upper(${vouchers.voucherNo}) = ${q}` : sql`1 = 0`),
		[q],
	);
	return data?.[0] ? toVoucher(data[0]) : undefined;
}

export function useVouchersByBeneficiaryNo(beneficiaryNo?: string): Voucher[] {
	const q = (beneficiaryNo ?? '').trim().toUpperCase();
	const { data } = useLiveQuery(
		db
			.select()
			.from(vouchers)
			.where(q ? sql`upper(${vouchers.beneficiaryNo}) = ${q}` : sql`1 = 0`)
			.orderBy(desc(vouchers.voucherNo)),
		[q],
	);
	return (data ?? []).map(toVoucher);
}

// ---- hampers -------------------------------------------------------------------

export function useHampers(): Hamper[] {
	const { data: hamperRows } = useLiveQuery(db.select().from(hampers));
	const { data: itemRows } = useLiveQuery(db.select().from(hamperItems));
	return (hamperRows ?? []).map((h) => ({
		id: h.id,
		name: h.name,
		items: (itemRows ?? [])
			.filter((i) => i.hamperId === h.id)
			.map((i) => ({
				itemName: i.itemName,
				unit: i.unit,
				qtyPerHousehold: i.qtyPerHousehold,
			})),
	}));
}

export function useHamper(id?: string): Hamper | undefined {
	return useHampers().find((h) => h.id === id);
}

// ---- stock -----------------------------------------------------------------------

// Stock is per warehouse (backend: Bin) — pass the active POS profile's
// warehouse. No warehouse → no rows, never a cross-warehouse mix.
export function useAgentStock(warehouse?: string): AgentStockRow[] {
	const { data } = useLiveQuery(
		db.select().from(agentStock).where(eq(agentStock.warehouse, warehouse ?? NONE)),
		[warehouse],
	);
	return data ?? [];
}

// ---- transactions ------------------------------------------------------------------

export function useTransactions(filter: 'all' | SyncStatus = 'all'): PosTransaction[] {
	const { data } = useLiveQuery(
		db
			.select()
			.from(posTransactions)
			.where(filter === 'all' ? undefined : eq(posTransactions.status, filter))
			.orderBy(desc(posTransactions.createdAt)),
		[filter],
	);
	return (data ?? []).map(toTransaction);
}

// Transactions recorded within one POS session — the reconciliation screen's
// basis, so closing session B never shows session A's activity. Newest first.
export function useSessionTransactions(sessionId?: string): PosTransaction[] {
	const { data } = useLiveQuery(
		db
			.select()
			.from(posTransactions)
			.where(eq(posTransactions.posSessionId, sessionId ?? NONE))
			.orderBy(desc(posTransactions.createdAt)),
		[sessionId],
	);
	return (data ?? []).map(toTransaction);
}

export function useTransaction(id?: string): PosTransaction | undefined {
	const { data } = useLiveQuery(
		db.select().from(posTransactions).where(eq(posTransactions.id, id ?? NONE)),
		[id],
	);
	return data?.[0] ? toTransaction(data[0]) : undefined;
}

// Pending/conflict counts for pills, banners, and the profile screen.
export function useSyncCounts(): { pending: number; conflicts: number } {
	const { data } = useLiveQuery(
		db
			.select({ status: posTransactions.status })
			.from(posTransactions)
			.where(
				or(
					eq(posTransactions.status, 'pending'),
					eq(posTransactions.status, 'conflict'),
				),
			),
	);
	const rows = data ?? [];
	return {
		pending: rows.filter((r) => r.status === 'pending').length,
		conflicts: rows.filter((r) => r.status === 'conflict').length,
	};
}

// ---- POS profile & sessions --------------------------------------------------

export function usePosProfile(id?: string): PosProfile | undefined {
	const { data } = useLiveQuery(
		db.select().from(posProfiles).where(eq(posProfiles.id, id ?? NONE)),
		[id],
	);
	return data?.[0];
}

// All profiles on this device — the post-login "choose your POS profile"
// screen. Real builds only ever pull profiles applicable to the logged-in user.
export function usePosProfiles(): PosProfile[] {
	const { data } = useLiveQuery(db.select().from(posProfiles).orderBy(posProfiles.name));
	return data ?? [];
}

// The one session currently open (at most one at a time — enforced on open).
export function useOpenPosSession(): PosSession | undefined {
	const { data } = useLiveQuery(
		db.select().from(posSessions).where(eq(posSessions.status, 'open')),
	);
	return data?.[0] ? toPosSession(data[0]) : undefined;
}

export function usePosSessions(): PosSession[] {
	const { data } = useLiveQuery(
		db.select().from(posSessions).orderBy(desc(posSessions.openedAt)),
	);
	return (data ?? []).map(toPosSession);
}

// Cash paid out within one session — reconciliation's expected-cash basis.
export function useSessionCashTotal(sessionId?: string): number {
	const { data } = useLiveQuery(
		db
			.select({ amount: posTransactions.amount })
			.from(posTransactions)
			.where(
				and(
					eq(posTransactions.posSessionId, sessionId ?? NONE),
					eq(posTransactions.type, 'cash_payment'),
				),
			),
		[sessionId],
	);
	return (data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
}

// ---- voucher redemptions --------------------------------------------------------

export function useRedemptionsForVoucher(voucherId?: string): VoucherRedemption[] {
	const { data } = useLiveQuery(
		db
			.select()
			.from(voucherRedemptions)
			.where(eq(voucherRedemptions.voucherId, voucherId ?? NONE))
			.orderBy(desc(voucherRedemptions.redeemedAt)),
		[voucherId],
	);
	return (data ?? []).map(toVoucherRedemption);
}

// Cash payments still unsynced today, grouped for the reconciliation screen.
export function useCashTransactions(): PosTransaction[] {
	const { data } = useLiveQuery(
		db
			.select()
			.from(posTransactions)
			.where(eq(posTransactions.type, 'cash_payment'))
			.orderBy(desc(posTransactions.createdAt)),
	);
	return (data ?? []).map(toTransaction);
}
