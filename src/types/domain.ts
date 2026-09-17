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
	bomId?: string; // the BOM whose components make up this voucher's hamper
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
	// The warehouse this voucher belongs to — scopes it to one POS profile.
	warehouse: string;
	assignmentId?: string;
	image?: string;
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
	bomId?: string; // the item's default BOM, when it has one
}

// ERPNext BOM — the authoritative contents of one hamper (backend: BOM +
// BOM Item). A goods voucher names its own BOM, so this is what the agent
// actually hands over; `quantity` is the yield the component qtys are per.
export interface BomLine {
	itemCode: string;
	itemName: string;
	unit: string;
	qty: number;
}

export interface Bom {
	id: string;
	itemCode: string;
	itemName: string;
	quantity: number;
	uom?: string;
	items: BomLine[];
}

// What a hamper contains, resolved for display. A voucher's own BOM wins;
// otherwise it falls back to the item's default-BOM expansion (hamper items),
// so vouchers issued before the backend gained `bom` still show something.
export interface HamperContents {
	bomId?: string;
	source: 'bom' | 'item';
	lines: { itemName: string; unit: string; qty: number }[];
}

// Enough to confirm the person in front of the agent — never the case file.
export interface Beneficiary {
	id: string; // = Voucher.beneficiaryNo
	fullName: string;
	idNumber?: string;
	status?: string;
	phone?: string;
	householdSize: number;
	beneficiaryType?: string;
	district?: string;
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
	closingPhotoUri?: string; // optional close-out photo attached to the entry
}

// One voucher use — mirrors the backend's Entitlement Redemption.
export interface VoucherRedemption {
	id: string;
	voucherId: string;
	transactionId: string;
	posOpeningEntry?: string;
	type: 'cash' | 'hamper';
	amount?: number;
	qty?: number;
	redeemedAt: string;
}

export interface AgentStockRow {
	warehouse: string; // the POS profile's warehouse this stock belongs to
	hamperId: string;
	hamperName: string;
	bomId?: string | null; // the item's default BOM — what a unit contains
	onHand: number;
	issuedToday: number;
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
	// Active POS profile's warehouse at record time (absent on older rows).
	warehouse?: string;
	project: string; // accounting ref (name string)
	assignmentId?: string;
	status: SyncStatus;
	conflictReason?: string; // server rejection message (status 'conflict')
	createdAt: string;
	serverName?: string;
}
