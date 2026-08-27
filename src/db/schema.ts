// Local SQLite schema — the source of truth for all domain data (AGENTS.md rule 1).
// Mirrors src/types/domain.ts; backend mapping in docs/NPPOS_WEB.md.
//
// The app mirrors the nppos web POS: it only deals with Entitlement Vouchers and
// Entitlement Redemptions. A voucher carries its entitlement inline (Goods|Cash),
// exactly like the backend's Entitlement Voucher (single item/qty/rate + amount,
// no child table). Redemptions link straight to the voucher.
//
// Conventions:
// - Pulled rows (assignments, vouchers, hampers, agent stock, pos profiles).
// - Locally created rows (pos_transactions, voucher_redemptions, pos_sessions)
//   use a client UUID as `id` forever; `serverName` is filled after sync.

import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Agent Disbursement Assignment — the agent's own slice (docs/FRAPPE_BACKEND.md).
// Projects/DOs are back-office hierarchy an agent never sees; the ADA is the
// agent-scoped grouping vouchers belong to. `project`/`disbursementOrder` are
// plain name strings (accounting refs), not links to local master tables.
export const assignments = sqliteTable('assignments', {
	id: text('id').primaryKey(),
	agentId: text('agent_id').notNull(),
	project: text('project').notNull(),
	disbursementOrder: text('disbursement_order'), // informational name string
	date: text('date'),
	amountToDisburse: real('amount_to_disburse').notNull().default(0),
});

export const hampers = sqliteTable('hampers', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
});

export const hamperItems = sqliteTable('hamper_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	hamperId: text('hamper_id')
		.notNull()
		.references(() => hampers.id),
	itemName: text('item_name').notNull(),
	unit: text('unit').notNull(),
	qtyPerHousehold: real('qty_per_household').notNull().default(1),
});

// ERPNext BOM — what one hamper actually contains. A goods voucher names its
// own BOM (Entitlement Voucher.bom), which is NOT always the item's default, so
// the components an agent hands over are read from here rather than from the
// item. `quantity` is the yield the component quantities are stated per.
export const boms = sqliteTable('boms', {
	id: text('id').primaryKey(), // BOM document name
	itemCode: text('item_code').notNull(),
	itemName: text('item_name').notNull(),
	quantity: real('quantity').notNull().default(1),
	uom: text('uom'),
});

export const bomItems = sqliteTable(
	'bom_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		bomId: text('bom_id')
			.notNull()
			.references(() => boms.id),
		itemCode: text('item_code').notNull(),
		itemName: text('item_name').notNull(),
		unit: text('unit').notNull(),
		qty: real('qty').notNull().default(0),
	},
	(t) => [index('bom_items_bom_idx').on(t.bomId)],
);

// The person behind a voucher — just enough for an agent to confirm they're
// facing the right recipient (name, ID number, status). Pulled for the parties
// on the agent's own vouchers only; walk-in vouchers have no row here.
export const beneficiaries = sqliteTable('beneficiaries', {
	id: text('id').primaryKey(), // = vouchers.beneficiary_no (Beneficiary name)
	fullName: text('full_name').notNull(),
	idNumber: text('id_number'),
	status: text('status'),
	phone: text('phone'),
	householdSize: integer('household_size').notNull().default(0),
	beneficiaryType: text('beneficiary_type'),
	district: text('district'),
});

// One voucher carries one entitlement inline — Goods (hamper/qty/uom/rate) OR
// Cash (amount) — mirroring the backend's Entitlement Voucher. Running redeemed
// totals drive partial-redemption status. Belongs to one assignment (ADA).
export const vouchers = sqliteTable(
	'vouchers',
	{
		id: text('id').primaryKey(),
		voucherNo: text('voucher_no').notNull().unique(),
		beneficiaryNo: text('beneficiary_no'), // walk-ins may have no beneficiary record
		entitlementType: text('entitlement_type', { enum: ['cash', 'hamper'] })
			.notNull()
			.default('cash'),
		// cash side
		amount: real('amount').notNull().default(0), // 0 for hamper vouchers
		// goods side (single item, no child table — like the backend)
		hamperId: text('hamper_id').references(() => hampers.id),
		// The BOM this voucher entitles — its components are what gets handed
		// over. Null on older/cash vouchers; the UI then falls back to the item's
		// default-BOM expansion in hamper_items.
		bomId: text('bom_id').references(() => boms.id),
		qty: real('qty'),
		uom: text('uom'),
		rate: real('rate'),
		// partial-redemption running totals
		redeemedAmount: real('redeemed_amount').notNull().default(0),
		redeemedQty: real('redeemed_qty').notNull().default(0),
		validFrom: text('valid_from').notNull(),
		validTo: text('valid_to').notNull(),
		status: text('status', { enum: ['active', 'partially_redeemed', 'redeemed', 'expired'] })
			.notNull()
			.default('active'),
		image: text('image'),
		usesCount: integer('uses_count').notNull().default(0),
		maxUses: integer('max_uses').notNull().default(2), // hard limit (AGENTS.md rule 4)
		// accounting ref that posts on the redemption (a plain name string)
		project: text('project').notNull(),
		// The warehouse this voucher belongs to (Entitlement Voucher.warehouse).
		// The device holds the vouchers of EVERY profile the agent can work
		// under, so this is what scopes a list to the active POS profile.
		warehouse: text('warehouse').notNull().default(''),
		assignmentId: text('assignment_id').references(() => assignments.id),
	},
	(t) => [
		index('vouchers_beneficiary_no_idx').on(t.beneficiaryNo),
		index('vouchers_warehouse_idx').on(t.warehouse),
	],
);

// Warehouse stock levels, decremented locally on goods redemption.
export const agentStock = sqliteTable(
	'agent_stock',
	{
		warehouse: text('warehouse').notNull(),
		hamperId: text('hamper_id')
			.notNull()
			.references(() => hampers.id),
		hamperName: text('hamper_name').notNull(),
		// Stock is held per item, so its contents are the item's DEFAULT BOM.
		bomId: text('bom_id').references(() => boms.id),
		onHand: integer('on_hand').notNull().default(0),
		issuedToday: integer('issued_today').notNull().default(0),
		damaged: integer('damaged').notNull().default(0),
	},
	(t) => [primaryKey({ columns: [t.warehouse, t.hamperId] })],
);

// Agent's POS configuration — maps to ERPNext POS Profile (pulled).
export const posProfiles = sqliteTable('pos_profiles', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	agentId: text('agent_id').notNull(),
	warehouse: text('warehouse').notNull(),
	currency: text('currency').notNull().default('SDG'),
});

// A working shift: opened before redeeming, closed at end of day. Maps to a
// POS Opening Entry on open and a POS Closing Entry on close (both via outbox).
export const posSessions = sqliteTable(
	'pos_sessions',
	{
		id: text('id').primaryKey(), // client UUID
		posProfileId: text('pos_profile_id')
			.notNull()
			.references(() => posProfiles.id),
		status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
		openedAt: text('opened_at').notNull(),
		closedAt: text('closed_at'),
		openingFloat: real('opening_float').notNull().default(0),
		// filled at close: expected = openingFloat − session cash payouts
		expectedCash: real('expected_cash'),
		countedCash: real('counted_cash'),
		// Optional close-out photo (signed sheet / fingerprint slip) captured at
		// close and attached to the POS Closing Entry on push. The local file uri
		// is kept only so the closed session can still show what was sent.
		closingPhotoUri: text('closing_photo_uri'),
		openingServerName: text('opening_server_name'), // POS Opening Entry name
		closingServerName: text('closing_server_name'), // POS Closing Entry name
	},
	(t) => [index('pos_sessions_status_idx').on(t.status)],
);

// One row per voucher use — maps to the backend's Entitlement Redemption.
// Links straight to the voucher (the voucher carries the entitlement).
export const voucherRedemptions = sqliteTable(
	'voucher_redemptions',
	{
		id: text('id').primaryKey(), // client UUID
		voucherId: text('voucher_id')
			.notNull()
			.references(() => vouchers.id),
		transactionId: text('transaction_id').notNull(), // pos_transactions.id
		posSessionId: text('pos_session_id'), // local session id
		// The POS Opening Entry's server name, stamped at redemption time. This is
		// what links the redemption to its shift on the backend: the POS Closing
		// Entry autofills its Linked Redemptions table from submitted redemptions
		// sharing its pos_opening_entry.
		posOpeningEntry: text('pos_opening_entry'),
		type: text('type', { enum: ['cash', 'hamper'] }).notNull(),
		amount: real('amount'),
		qty: real('qty'),
		redeemedAt: text('redeemed_at').notNull(),
	},
	(t) => [index('voucher_redemptions_voucher_idx').on(t.voucherId)],
);

// Local-first. id is a client UUID and never changes (ARCHITECTURE.md §4).
export const posTransactions = sqliteTable(
	'pos_transactions',
	{
		id: text('id').primaryKey(),
		type: text('type', {
			enum: ['goods_issue', 'cash_payment', 'stock_return'],
		}).notNull(),
		title: text('title').notNull(),
		subtitle: text('subtitle').notNull(),
		amount: real('amount'),
		qty: real('qty'),
		beneficiaryName: text('beneficiary_name'),
		voucherNo: text('voucher_no'),
		posSessionId: text('pos_session_id'),
		// Working context at record time — the active POS profile's warehouse.
		// Scopes the transaction list to the profile the agent is working under
		// (null on rows written before this column existed).
		warehouse: text('warehouse'),
		project: text('project').notNull(), // accounting ref (name string)
		assignmentId: text('assignment_id'),
		status: text('status', { enum: ['pending', 'synced', 'conflict'] })
			.notNull()
			.default('pending'),
		conflictReason: text('conflict_reason'),
		createdAt: text('created_at').notNull(),
		syncedAt: text('synced_at'),
		serverName: text('server_name'),
	},
	(t) => [index('pos_transactions_status_idx').on(t.status)],
);

// One row per pending push; written in the same transaction as the domain row.
export const outbox = sqliteTable('outbox', {
	id: text('id').primaryKey(), // = pos_transactions.id (idempotency key)
	payload: text('payload').notNull(), // JSON
	attemptCount: integer('attempt_count').notNull().default(0),
	nextRetryAt: text('next_retry_at'),
	lastError: text('last_error'),
	createdAt: text('created_at').notNull(),
});

// Per-collection pull cursors for delta sync (unused until sync lands).
export const syncMeta = sqliteTable('sync_meta', {
	collection: text('collection').primaryKey(),
	cursor: text('cursor'),
	lastPulledAt: text('last_pulled_at'),
});
