// All reactive reads. Screens use these hooks — never Drizzle directly
// (docs/ARCHITECTURE.md §6). Every hook is a useLiveQuery over the local DB, so
// any mutation (see mutations.ts) re-renders consumers automatically.

import { db } from '@/db/client';
import {
	agentStock,
	assignments,
	beneficiaries,
	bomItems,
	boms,
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
	Beneficiary,
	Bom,
	Hamper,
	HamperContents,
	PosProfile,
	PosSession,
	PosTransaction,
	SyncStatus,
	Voucher,
	VoucherRedemption,
} from '@/types/domain';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import {
	toAssignment,
	toBeneficiary,
	toPosSession,
	toTransaction,
	toVoucher,
	toVoucherRedemption,
} from './mappers';

// Sentinel for "no id yet" params so hooks can run unconditionally.
const NONE = '__none__';

// The statuses an agent can still issue against (docs/NPPOS_WEB.md): a
// partially redeemed voucher still has value left on it.
const REDEEMABLE_STATUSES = ['active', 'partially_redeemed'] as const;

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

// One-shot version of the search above, for callers that need an answer now
// rather than a subscription — the QR scanner decides whether to jump straight
// to the voucher or fall back to showing "no match".
export function findVoucherByNo(voucherNo: string): Voucher | undefined {
	const q = voucherNo.trim().toUpperCase();
	if (!q) return undefined;
	const rows = db
		.select()
		.from(vouchers)
		.where(sql`upper(${vouchers.voucherNo}) = ${q}`)
		.limit(1)
		.all();
	return rows[0] ? toVoucher(rows[0]) : undefined;
}

// Searching a beneficiary number lists what the agent can still act on —
// redeemed and expired vouchers are noise at a distribution point — and only
// what belongs to the warehouse they are working under, since the device holds
// every profile's vouchers at once. (An exact voucher-number lookup deliberately
// does NOT filter either way: the agent scanned that specific voucher and needs
// to be told it's spent or belongs elsewhere, not "no match".)
export function useVouchersByBeneficiaryNo(
	beneficiaryNo?: string,
	warehouse?: string,
): Voucher[] {
	const q = (beneficiaryNo ?? '').trim().toUpperCase();
	const { data } = useLiveQuery(
		db
			.select()
			.from(vouchers)
			.where(
				q && warehouse
					? and(
							sql`upper(${vouchers.beneficiaryNo}) = ${q}`,
							inArray(vouchers.status, REDEEMABLE_STATUSES),
							eq(vouchers.warehouse, warehouse),
						)
					: sql`1 = 0`,
			)
			.orderBy(desc(vouchers.voucherNo)),
		[q, warehouse],
	);
	return (data ?? []).map(toVoucher);
}

// ---- beneficiaries -------------------------------------------------------------

// The person a voucher belongs to — name/ID/status, shown at issue time so the
// agent can confirm who they're facing. Walk-in vouchers have no row.
export function useBeneficiary(beneficiaryNo?: string): Beneficiary | undefined {
	const { data } = useLiveQuery(
		db.select().from(beneficiaries).where(eq(beneficiaries.id, beneficiaryNo ?? NONE)),
		[beneficiaryNo],
	);
	return data?.[0] ? toBeneficiary(data[0]) : undefined;
}

// Names for a set of vouchers in one query — the search list labels each result
// with its beneficiary rather than a bare code.
export function useBeneficiaryNames(ids: (string | undefined)[]): Record<string, string> {
	const wanted = Array.from(new Set(ids.filter((v): v is string => !!v)));
	const key = wanted.join(',');
	const { data } = useLiveQuery(
		db
			.select({ id: beneficiaries.id, fullName: beneficiaries.fullName })
			.from(beneficiaries)
			.where(wanted.length > 0 ? inArray(beneficiaries.id, wanted) : sql`1 = 0`),
		[key],
	);
	return Object.fromEntries((data ?? []).map((r) => [r.id, r.fullName]));
}

// ---- BOMs / hamper contents ----------------------------------------------------

export function useBom(bomId?: string | null): Bom | undefined {
	const { data: bomRows } = useLiveQuery(
		db.select().from(boms).where(eq(boms.id, bomId ?? NONE)),
		[bomId],
	);
	const { data: lineRows } = useLiveQuery(
		db.select().from(bomItems).where(eq(bomItems.bomId, bomId ?? NONE)).orderBy(bomItems.id),
		[bomId],
	);
	const bom = bomRows?.[0];
	if (!bom) return undefined;
	return {
		id: bom.id,
		itemCode: bom.itemCode,
		itemName: bom.itemName,
		quantity: bom.quantity,
		uom: bom.uom ?? undefined,
		items: (lineRows ?? []).map((l) => ({
			itemCode: l.itemCode,
			itemName: l.itemName,
			unit: l.unit,
			qty: l.qty,
		})),
	};
}

// What's inside one hamper, for the contents popup. The BOM the voucher (or
// stock row) names wins; without one we fall back to the item's default-BOM
// expansion the pull already sends as hamper items.
export function useHamperContents(
	bomId?: string | null,
	hamperId?: string | null,
): HamperContents | undefined {
	const bom = useBom(bomId);
	const hamper = useHamper(hamperId ?? undefined);
	if (bom && bom.items.length > 0) {
		return {
			bomId: bom.id,
			source: 'bom',
			lines: bom.items.map((i) => ({ itemName: i.itemName, unit: i.unit, qty: i.qty })),
		};
	}
	if (hamper && hamper.items.length > 0) {
		return {
			source: 'item',
			lines: hamper.items.map((i) => ({
				itemName: i.itemName,
				unit: i.unit,
				qty: i.qtyPerHousehold,
			})),
		};
	}
	return undefined;
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

// The agent's transactions, scoped to the POS profile they are working under.
// Pass the active profile's warehouse: the device accumulates the transactions
// of every profile it has ever worked, and showing another warehouse's payouts
// under this one misrepresents the shift. Omitting it returns everything (the
// admin/debug view). Rows recorded before transactions carried a warehouse have
// none and therefore fall outside any scoped list.
//
// The list is also capped by the retention setting (AIGT HDR Settings › POS
// App): after each sync, synced rows beyond it are pruned from the device
// (src/repositories/maintenance.ts). Pending and needs-review rows never are.
export function useTransactions(
	filter: 'all' | SyncStatus = 'all',
	warehouse?: string,
): PosTransaction[] {
	const statusFilter = filter === 'all' ? undefined : eq(posTransactions.status, filter);
	const scope = warehouse ? eq(posTransactions.warehouse, warehouse) : undefined;
	const { data } = useLiveQuery(
		db
			.select()
			.from(posTransactions)
			.where(statusFilter && scope ? and(statusFilter, scope) : (statusFilter ?? scope))
			.orderBy(desc(posTransactions.createdAt)),
		[filter, warehouse],
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

// Did this session's opening actually land on the backend? Imperative because
// the caller (opening a shift) needs the answer right after its push, not a
// subscription. Null server name = the POS Opening Entry doesn't exist yet.
export function posSessionServerName(sessionId: string): string | undefined {
	const row = db
		.select({ serverName: posSessions.openingServerName })
		.from(posSessions)
		.where(eq(posSessions.id, sessionId))
		.get();
	return row?.serverName ?? undefined;
}

export function usePosSessions(): PosSession[] {
	const { data } = useLiveQuery(
		db.select().from(posSessions).orderBy(desc(posSessions.openedAt)),
	);
	return (data ?? []).map(toPosSession);
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
