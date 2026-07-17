// Shared domain types for the HDR disbursement POS.
// These mirror the local-DB model in docs/ARCHITECTURE.md §3. For now they back
// dummy data only — no SQLite, no adapter. Keep them stable so the eventual
// MockAdapter / FrappeAdapter can serve the same shapes.

export type Role = 'agent' | 'admin';

export type EntitlementType = 'hamper' | 'cash' | 'card';

export type TransactionType =
	| 'goods_issue'
	| 'cash_payment'
	| 'card_withdrawal'
	| 'stock_return';

export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type VoucherStatus = 'active' | 'partially_redeemed' | 'redeemed' | 'expired';

export interface Project {
	id: string;
	name: string;
	code: string;
}

export interface DisbursementOrder {
	id: string;
	name: string;
	projectId: string;
	status: 'open' | 'closed';
	totalBeneficiaries: number;
	issuedCount: number;
}

export interface Agent {
	id: string;
	name: string;
	code: string; // warehouse code
	role: Role;
	region: string;
}

export interface Beneficiary {
	id: string;
	beneficiaryNo: string;
	name: string;
	nationalId: string;
	phone: string;
	householdSize: number;
	projectId: string;
	assignmentId: string;
	// derived convenience (mock-data era; DB reads derive via entitlements table)
	entitlementIds?: string[];
	lastIssuedAt?: string;
}

export interface Voucher {
	id: string;
	voucherNo: string;
	beneficiaryNo?: string; // walk-ins may not map to a beneficiary record
	// one entitlement per voucher Goods|Cash
	entitlementType: 'cash' | 'hamper';
	amount: number; // 0 for hamper vouchers
	validFrom: string;
	validTo: string;
	status: VoucherStatus;
	usesCount: number; // hard cap of 2
	maxUses: number;
	projectId: string;
	disbursementOrderId: string;
	entitlementIds?: string[];
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

export interface Entitlement {
	id: string;
	type: EntitlementType;
	// goods
	hamperId?: string;
	qty?: number;
	// cash / card
	amount?: number;
	status: 'available' | 'issued';
	beneficiaryId?: string;
	voucherId?: string;
	projectId: string;
	disbursementOrderId: string;
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
	entitlementId: string;
	transactionId: string;
	type: 'cash' | 'hamper';
	amount?: number;
	qty?: number;
	redeemedAt: string;
}

export interface AgentStockRow {
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
	beneficiaryId?: string;
	beneficiaryName?: string;
	voucherNo?: string;
	entitlementId?: string;
	posSessionId?: string;
	projectId: string;
	disbursementOrderId: string;
	status: SyncStatus;
	createdAt: string;
	serverName?: string;
}
