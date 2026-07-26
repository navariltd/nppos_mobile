// Shared domain types for the nppos POS (mirrors the nppos web POS).
// These mirror the local-DB model in src/db/schema.ts. The app only deals with
// Entitlement Vouchers and Entitlement Redemptions (docs/NPPOS_WEB.md).

export type Role = 'agent' | 'admin';

export type TransactionType = 'goods_issue' | 'cash_payment' | 'stock_return';

export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type VoucherStatus = 'active' | 'partially_redeemed' | 'redeemed' | 'expired';

// Agent Disbursement Assignment — the agent's own slice (docs/FRAPPE_BACKEND.md).
// `project`/`disbursementOrder` are plain name strings, not links to master
// tables the agent shouldn't see.
export interface Assignment {
	id: string;
	agentId: string;
	project: string;
	disbursementOrder?: string;
	date?: string;
	amountToDisburse: number;
}

export interface Agent {
	id: string;
	name: string;
	email: string; // login identity (backend: Frappe user)
	code: string; // warehouse code
	role: Role;
	region: string;
}

export interface Voucher {
	id: string;
	voucherNo: string;
	beneficiaryNo?: string; // walk-ins may not map to a beneficiary record
	// one entitlement per voucher — Goods|Cash, inline like the backend
	entitlementType: 'cash' | 'hamper';
	amount: number; // cash side; 0 for hamper vouchers
	// goods side
	hamperId?: string;
	qty?: number;
	uom?: string;
	rate?: number;
	// partial-redemption running totals
	redeemedAmount: number;
	redeemedQty: number;
	validFrom: string;
	validTo: string;
	status: VoucherStatus;
	usesCount: number; // hard cap of 2
	maxUses: number;
	project: string; // accounting ref (name string)
	assignmentId?: string;
}

export interface HamperItem {
	itemName: string;
	unit: string;
	qtyPerHousehold: number;
}

export interface Hamper {
	id: string;
	name: string; // e.g. "Project 1-Jun-2026-Food Basket A"
	items: HamperItem[];
}

export interface PosProfile {
	id: string;
	name: string;
	agentId: string;
	warehouse: string;
	currency: string;
}

// A working shift. Opens as a POS Opening Entry and closes as a POS Closing
// Entry on the backend.
export interface PosSession {
	id: string;
	posProfileId: string;
	status: 'open' | 'closed';
	openedAt: string;
	closedAt?: string;
	openingFloat: number;
	expectedCash?: number;
	countedCash?: number;
}

// One voucher use — mirrors the backend's Entitlement Redemption.
export interface VoucherRedemption {
	id: string;
	voucherId: string;
	transactionId: string;
	type: 'cash' | 'hamper';
	amount?: number;
	qty?: number;
	redeemedAt: string;
}

export interface AgentStockRow {
	warehouse: string; // the POS profile's warehouse this stock belongs to
	hamperId: string;
	hamperName: string;
	onHand: number;
	issuedToday: number;
	damaged: number;
}

export interface PosTransaction {
	id: string; // client UUID
	type: TransactionType;
	title: string;
	subtitle: string;
	amount?: number;
	qty?: number;
	beneficiaryName?: string;
	voucherNo?: string;
	posSessionId?: string;
	project: string; // accounting ref (name string)
	assignmentId?: string;
	status: SyncStatus;
	conflictReason?: string; // server rejection message (status 'conflict')
	createdAt: string;
	serverName?: string;
}
