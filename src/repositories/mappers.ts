// DB rows → domain types. SQLite nullable columns become the optional/required
// shapes in src/types/domain.ts so screens keep the types they already use.

import type {
	assignments,
	posSessions,
	posTransactions,
	voucherRedemptions,
	vouchers,
} from '@/db/schema';
import type {
	Assignment,
	PosSession,
	PosTransaction,
	Voucher,
	VoucherRedemption,
} from '@/types/domain';

export function toAssignment(r: typeof assignments.$inferSelect): Assignment {
	return {
		id: r.id,
		agentId: r.agentId,
		project: r.project,
		disbursementOrder: r.disbursementOrder ?? undefined,
		date: r.date ?? undefined,
		amountToDisburse: r.amountToDisburse,
	};
}

export function toVoucher(r: typeof vouchers.$inferSelect): Voucher {
	return {
		id: r.id,
		voucherNo: r.voucherNo,
		beneficiaryNo: r.beneficiaryNo ?? undefined,
		entitlementType: r.entitlementType,
		amount: r.amount,
		hamperId: r.hamperId ?? undefined,
		qty: r.qty ?? undefined,
		uom: r.uom ?? undefined,
		rate: r.rate ?? undefined,
		redeemedAmount: r.redeemedAmount,
		redeemedQty: r.redeemedQty,
		validFrom: r.validFrom,
		validTo: r.validTo,
		status: r.status,
		usesCount: r.usesCount,
		maxUses: r.maxUses,
		project: r.project,
		assignmentId: r.assignmentId ?? undefined,
		image: r.image ?? undefined,
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
		beneficiaryName: r.beneficiaryName ?? undefined,
		voucherNo: r.voucherNo ?? undefined,
		posSessionId: r.posSessionId ?? undefined,
		project: r.project,
		assignmentId: r.assignmentId ?? undefined,
		status: r.status,
		conflictReason: r.conflictReason ?? undefined,
		createdAt: r.createdAt,
		serverName: r.serverName ?? undefined,
	};
}

export function toPosSession(r: typeof posSessions.$inferSelect): PosSession {
	return {
		id: r.id,
		posProfileId: r.posProfileId,
		status: r.status,
		openedAt: r.openedAt,
		closedAt: r.closedAt ?? undefined,
		openingFloat: r.openingFloat,
		expectedCash: r.expectedCash ?? undefined,
		countedCash: r.countedCash ?? undefined,
	};
}

export function toVoucherRedemption(
	r: typeof voucherRedemptions.$inferSelect,
): VoucherRedemption {
	return {
		id: r.id,
		voucherId: r.voucherId,
		transactionId: r.transactionId,
		type: r.type,
		amount: r.amount ?? undefined,
		qty: r.qty ?? undefined,
		redeemedAt: r.redeemedAt,
	};
}
