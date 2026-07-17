// DB rows → domain types. SQLite nullable columns become the optional/required
// shapes in src/types/domain.ts so screens keep the types they already use.

import type {
	beneficiaries,
	disbursementOrders,
	entitlements,
	posTransactions,
	vouchers,
} from '@/db/schema';
import type {
	Beneficiary,
	DisbursementOrder,
	Entitlement,
	PosTransaction,
	Voucher,
} from '@/types/domain';

export function toBeneficiary(r: typeof beneficiaries.$inferSelect): Beneficiary {
	return {
		id: r.id,
		beneficiaryNo: r.beneficiaryNo,
		name: r.name,
		nationalId: r.nationalId ?? '—',
		phone: r.phone ?? '—',
		householdSize: r.householdSize,
		projectId: r.projectId,
		assignmentId: r.assignmentId,
		lastIssuedAt: r.lastIssuedAt ?? undefined,
	};
}

export function toVoucher(r: typeof vouchers.$inferSelect): Voucher {
	return {
		id: r.id,
		voucherNo: r.voucherNo,
		beneficiaryNo: r.beneficiaryNo ?? undefined,
		amount: r.amount,
		validFrom: r.validFrom,
		validTo: r.validTo,
		status: r.status,
		usesCount: r.usesCount,
		maxUses: r.maxUses,
		projectId: r.projectId,
		disbursementOrderId: r.disbursementOrderId,
	};
}

export function toEntitlement(r: typeof entitlements.$inferSelect): Entitlement {
	return {
		id: r.id,
		type: r.type,
		hamperId: r.hamperId ?? undefined,
		qty: r.qty ?? undefined,
		amount: r.amount ?? undefined,
		status: r.status,
		beneficiaryId: r.beneficiaryId ?? undefined,
		voucherId: r.voucherId ?? undefined,
		projectId: r.projectId,
		disbursementOrderId: r.disbursementOrderId,
	};
}

export function toTransaction(r: typeof posTransactions.$inferSelect): PosTransaction {
	return {
		id: r.id,
		type: r.type,
		title: r.title,
		subtitle: r.subtitle,
		amount: r.amount ?? undefined,
		qty: r.qty ?? undefined,
		beneficiaryId: r.beneficiaryId ?? undefined,
		beneficiaryName: r.beneficiaryName ?? undefined,
		voucherNo: r.voucherNo ?? undefined,
		entitlementId: r.entitlementId ?? undefined,
		projectId: r.projectId,
		disbursementOrderId: r.disbursementOrderId,
		status: r.status,
		createdAt: r.createdAt,
		serverName: r.serverName ?? undefined,
	};
}

export function toDisbursementOrder(
	r: typeof disbursementOrders.$inferSelect,
): DisbursementOrder {
	return {
		id: r.id,
		name: r.name,
		projectId: r.projectId,
		status: r.status,
		totalBeneficiaries: r.totalBeneficiaries,
		issuedCount: r.issuedCount,
	};
}
