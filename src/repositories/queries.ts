// All reactive reads. Screens use these hooks — never Drizzle directly
// (docs/ARCHITECTURE.md §6). Every hook is a useLiveQuery over the local DB, so
// any mutation (see mutations.ts) re-renders consumers automatically.

import { db } from '@/db/client';
import {
	agentStock,
	beneficiaries,
	disbursementOrders,
	entitlements,
	hamperItems,
	hampers,
	posProfiles,
	posSessions,
	posTransactions,
	projects,
	voucherRedemptions,
	vouchers,
} from '@/db/schema';
import type {
	AgentStockRow,
	Beneficiary,
	DisbursementOrder,
	Entitlement,
	Hamper,
	PosProfile,
	PosSession,
	PosTransaction,
	Project,
	SyncStatus,
	Voucher,
	VoucherRedemption,
} from '@/types/domain';
import { and, desc, eq, like, or } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import {
	toBeneficiary,
	toDisbursementOrder,
	toEntitlement,
	toPosSession,
	toTransaction,
	toVoucher,
	toVoucherRedemption,
} from './mappers';

// Sentinel for "no id yet" params so hooks can run unconditionally.
const NONE = '__none__';

// ---- projects & orders ------------------------------------------------------

export function useProject(id?: string): Project | undefined {
	const { data } = useLiveQuery(
		db.select().from(projects).where(eq(projects.id, id ?? NONE)),
		[id],
	);
	return data?.[0];
}

export function useProjects(): Project[] {
	const { data } = useLiveQuery(db.select().from(projects));
	return data ?? [];
}

export function useDisbursementOrders(): DisbursementOrder[] {
	const { data } = useLiveQuery(db.select().from(disbursementOrders));
	return (data ?? []).map(toDisbursementOrder);
}

// ---- beneficiaries ----------------------------------------------------------

export function useBeneficiaries(query = ''): Beneficiary[] {
	const q = query.trim();
	const { data } = useLiveQuery(
		db
			.select()
			.from(beneficiaries)
			.where(
				q
					? or(
							like(beneficiaries.name, `%${q}%`),
							like(beneficiaries.beneficiaryNo, `%${q}%`),
						)
					: undefined,
			)
			.orderBy(beneficiaries.name),
		[q],
	);
	return (data ?? []).map(toBeneficiary);
}

export function useBeneficiary(id?: string): Beneficiary | undefined {
	const { data } = useLiveQuery(
		db.select().from(beneficiaries).where(eq(beneficiaries.id, id ?? NONE)),
		[id],
	);
	return data?.[0] ? toBeneficiary(data[0]) : undefined;
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

// Imperative search (button-triggered screens; results don't need to be live).
export function findVoucherByNo(voucherNo: string): Voucher | undefined {
	const rows = db
		.select()
		.from(vouchers)
		.where(eq(vouchers.voucherNo, voucherNo.trim().toUpperCase()))
		.all();
	return rows[0] ? toVoucher(rows[0]) : undefined;
}

export function findVouchersByBeneficiaryNo(beneficiaryNo: string): Voucher[] {
	return db
		.select()
		.from(vouchers)
		.where(eq(vouchers.beneficiaryNo, beneficiaryNo.trim().toUpperCase()))
		.all()
		.map(toVoucher);
}

// ---- entitlements -------------------------------------------------------------

export function useEntitlement(id?: string): Entitlement | undefined {
	const { data } = useLiveQuery(
		db.select().from(entitlements).where(eq(entitlements.id, id ?? NONE)),
		[id],
	);
	return data?.[0] ? toEntitlement(data[0]) : undefined;
}

export function useEntitlementsForBeneficiary(beneficiaryId?: string): Entitlement[] {
	const { data } = useLiveQuery(
		db
			.select()
			.from(entitlements)
			.where(eq(entitlements.beneficiaryId, beneficiaryId ?? NONE)),
		[beneficiaryId],
	);
	return (data ?? []).map(toEntitlement);
}

export function useEntitlementsForVoucher(voucherId?: string): Entitlement[] {
	const { data } = useLiveQuery(
		db
			.select()
			.from(entitlements)
			.where(eq(entitlements.voucherId, voucherId ?? NONE)),
		[voucherId],
	);
	return (data ?? []).map(toEntitlement);
}

// All entitlements still available, for pickers/counts.
export function useAvailableEntitlements(): Entitlement[] {
	const { data } = useLiveQuery(
		db.select().from(entitlements).where(eq(entitlements.status, 'available')),
	);
	return (data ?? []).map(toEntitlement);
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

export function useAgentStock(): AgentStockRow[] {
	const { data } = useLiveQuery(db.select().from(agentStock));
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

export function useTransaction(id?: string): PosTransaction | undefined {
	const { data } = useLiveQuery(
		db.select().from(posTransactions).where(eq(posTransactions.id, id ?? NONE)),
		[id],
	);
	return data?.[0] ? toTransaction(data[0]) : undefined;
}

export function useBeneficiaryTransactions(beneficiaryId?: string): PosTransaction[] {
	const { data } = useLiveQuery(
		db
			.select()
			.from(posTransactions)
			.where(eq(posTransactions.beneficiaryId, beneficiaryId ?? NONE))
			.orderBy(desc(posTransactions.createdAt)),
		[beneficiaryId],
	);
	return (data ?? []).map(toTransaction);
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

export function usePosProfile(): PosProfile | undefined {
	const { data } = useLiveQuery(db.select().from(posProfiles).limit(1));
	return data?.[0];
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
