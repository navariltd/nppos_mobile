// Local SQLite schema — the source of truth for all domain data (AGENTS.md rule 1).
// Mirrors src/types/domain.ts; backend mapping in docs/FRAPPE_BACKEND.md.
//
// Conventions:
// - Pulled rows (projects, DOs, assignments, beneficiaries, vouchers, hampers,
//   entitlements).
// - Locally created rows (pos_transactions) use a client UUID as `id` forever;
//   `serverName` is filled after sync.

import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	code: text('code').notNull(),
});

export const disbursementOrders = sqliteTable('disbursement_orders', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	// backend: Cash | Physical Goods | Services
	disbursementType: text('disbursement_type', {
		enum: ['cash', 'goods', 'services'],
	})
		.notNull()
		.default('cash'),
	status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
	totalBeneficiaries: integer('total_beneficiaries').notNull().default(0),
	issuedCount: integer('issued_count').notNull().default(0),
});

// Agent Disbursement Assignment — the agent's per-DO slice (docs/FRAPPE_BACKEND.md).
export const assignments = sqliteTable('assignments', {
	id: text('id').primaryKey(),
	disbursementOrderId: text('disbursement_order_id')
		.notNull()
		.references(() => disbursementOrders.id),
	agentId: text('agent_id').notNull(),
	date: text('date'),
	amountToDisburse: real('amount_to_disburse').notNull().default(0),
});

export const beneficiaries = sqliteTable(
	'beneficiaries',
	{
		id: text('id').primaryKey(),
		beneficiaryNo: text('beneficiary_no').notNull(),
		name: text('name').notNull(),
		nationalId: text('national_id'),
		phone: text('phone'),
		householdSize: integer('household_size').notNull().default(1),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id),
		assignmentId: text('assignment_id').notNull(),
		lastIssuedAt: text('last_issued_at'),
	},
	(t) => [index('beneficiaries_no_idx').on(t.beneficiaryNo)],
);

export const vouchers = sqliteTable(
	'vouchers',
	{
		id: text('id').primaryKey(),
		voucherNo: text('voucher_no').notNull().unique(),
		beneficiaryNo: text('beneficiary_no'), // walk-ins may have no beneficiary row
		// One entitlement per voucher, like the backend's Entitlement Voucher
		// (Goods|Cash). The linked entitlements row carries the detail 
		// (hamperId/qty or amount); exactly one exists per voucher.
		entitlementType: text('entitlement_type', { enum: ['cash', 'hamper'] })
			.notNull()
			.default('cash'),
		amount: real('amount').notNull().default(0), // 0 for hamper vouchers
		validFrom: text('valid_from').notNull(),
		validTo: text('valid_to').notNull(),
		status: text('status', { enum: ['active', 'partially_redeemed', 'redeemed', 'expired'] })
			.notNull()
			.default('active'),
		usesCount: integer('uses_count').notNull().default(0),
		maxUses: integer('max_uses').notNull().default(2), // hard limit (AGENTS.md rule 4)
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id),
		disbursementOrderId: text('disbursement_order_id')
			.notNull()
			.references(() => disbursementOrders.id),
	},
	(t) => [index('vouchers_beneficiary_no_idx').on(t.beneficiaryNo)],
);

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

export const entitlements = sqliteTable(
	'entitlements',
	{
		id: text('id').primaryKey(),
		type: text('type', { enum: ['hamper', 'cash', 'card'] }).notNull(),
		hamperId: text('hamper_id').references(() => hampers.id),
		qty: real('qty'),
		amount: real('amount'),
		status: text('status', { enum: ['available', 'issued'] })
			.notNull()
			.default('available'),
		// exactly one of these two is set
		beneficiaryId: text('beneficiary_id').references(() => beneficiaries.id),
		voucherId: text('voucher_id').references(() => vouchers.id),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id),
		disbursementOrderId: text('disbursement_order_id')
			.notNull()
			.references(() => disbursementOrders.id),
	},
	(t) => [
		index('entitlements_beneficiary_idx').on(t.beneficiaryId),
		index('entitlements_voucher_idx').on(t.voucherId),
	],
);

// Warehouse stock levels, decremented locally on goods issue.
export const agentStock = sqliteTable(
	'agent_stock',
	{
		warehouse: text('warehouse').notNull(),
		hamperId: text('hamper_id')
			.notNull()
			.references(() => hampers.id),
		hamperName: text('hamper_name').notNull(),
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
	currency: text('currency').notNull().default('KES'),
});

// A working shift: opened before issuing, closed at end of day. Maps to a
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
		// filled at close: expected = openingFloat + session cash payouts
		expectedCash: real('expected_cash'),
		countedCash: real('counted_cash'),
		openingServerName: text('opening_server_name'), // POS Opening Entry name
		closingServerName: text('closing_server_name'), // POS Closing Entry name
	},
	(t) => [index('pos_sessions_status_idx').on(t.status)],
);

// One row per voucher use — maps to the backend's Entitlement Redemption.
export const voucherRedemptions = sqliteTable(
	'voucher_redemptions',
	{
		id: text('id').primaryKey(), // client UUID
		voucherId: text('voucher_id')
			.notNull()
			.references(() => vouchers.id),
		entitlementId: text('entitlement_id')
			.notNull()
			.references(() => entitlements.id),
		transactionId: text('transaction_id').notNull(), // pos_transactions.id
		posSessionId: text('pos_session_id'),
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
			enum: ['goods_issue', 'cash_payment', 'card_withdrawal', 'stock_return'],
		}).notNull(),
		title: text('title').notNull(),
		subtitle: text('subtitle').notNull(),
		amount: real('amount'),
		qty: real('qty'),
		beneficiaryId: text('beneficiary_id'),
		beneficiaryName: text('beneficiary_name'),
		voucherNo: text('voucher_no'),
		entitlementId: text('entitlement_id'),
		posSessionId: text('pos_session_id'),
		projectId: text('project_id').notNull(),
		disbursementOrderId: text('disbursement_order_id').notNull(),
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
