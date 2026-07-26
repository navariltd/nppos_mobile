// All local writes. Each mutation follows AGENTS.md hard rules: one SQLite
// transaction writing the domain row(s) plus an outbox row keyed by a client
// UUID; voucher limit/validity is validated here at redemption time. Screens get
// a plain { ok } | { ok: false, reason } result to surface.
//
// The app mirrors the nppos web POS: a voucher carries its entitlement inline
// (Cash|Goods) and each redemption maps to one Entitlement Redemption. Agents may
// redeem LESS than the voucher's cash amount / goods qty (partial redemption),
// across the 2 allowed uses.

import { db } from '@/db/client';
import {
	agentStock,
	assignments,
	hampers,
	outbox,
	posProfiles,
	posSessions,
	posTransactions,
	voucherRedemptions,
	vouchers,
} from '@/db/schema';
import { uuid } from '@/lib/uuid';
import { and, eq, sql } from 'drizzle-orm';

export type MutationResult = { ok: true; transactionId: string } | { ok: false; reason: string };

function nowIso(): string {
	return new Date().toISOString();
}

function today(): string {
	return nowIso().slice(0, 10);
}

function getOpenSession() {
	return db.select().from(posSessions).where(eq(posSessions.status, 'open')).get();
}

type VoucherContext =
	| { error: string; voucher?: never }
	| { error?: undefined; voucher: typeof vouchers.$inferSelect; recipientLabel: string };

// Load a voucher and validate it is redeemable (status, validity, use count).
// Shared by the cash and goods redemption paths.
function loadVoucherForRedeem(voucherId: string): VoucherContext {
	const voucher = db.select().from(vouchers).where(eq(vouchers.id, voucherId)).get();
	if (!voucher) return { error: 'Voucher not found.' } as const;

	// Backend statuses (docs/NPPOS_WEB.md): partially redeemed is still usable.
	if (voucher.status !== 'active' && voucher.status !== 'partially_redeemed') {
		return {
			error:
				voucher.status === 'redeemed'
					? 'Voucher is fully redeemed.'
					: 'Voucher is outside its validity window.',
		} as const;
	}
	if (voucher.usesCount >= voucher.maxUses) {
		return { error: `Voucher has reached its ${voucher.maxUses}-use limit.` } as const;
	}
	// Only enforce the bounds that are actually set — the backend leaves
	// valid_from/valid_to blank ('') on open-ended vouchers, and '' must not read
	// as "expired" (any date string compares greater than '').
	const day = today();
	if (voucher.validFrom && day < voucher.validFrom) {
		return { error: 'Voucher is not valid yet.' } as const;
	}
	if (voucher.validTo && day > voucher.validTo) {
		return { error: 'Voucher is outside its validity window.' } as const;
	}

	const recipientLabel = voucher.beneficiaryNo
		? `${voucher.beneficiaryNo} · ${voucher.voucherNo}`
		: `Voucher ${voucher.voucherNo}`;

	return { voucher, recipientLabel } as const;
}

// Voucher status after a redemption: fully drawn OR uses exhausted → redeemed.
function nextVoucherStatus(
	voucher: typeof vouchers.$inferSelect,
	fullyDrawn: boolean,
): 'redeemed' | 'partially_redeemed' {
	const usesExhausted = voucher.usesCount + 1 >= voucher.maxUses;
	return fullyDrawn || usesExhausted ? 'redeemed' : 'partially_redeemed';
}

// ---- cash redemption (partial-capable) --------------------------------------

export function redeemVoucherCash(voucherId: string, amount: number): MutationResult {
	const ctx = loadVoucherForRedeem(voucherId);
	if (ctx.error !== undefined) return { ok: false, reason: ctx.error };
	const { voucher, recipientLabel } = ctx;
	if (voucher.entitlementType !== 'cash') return { ok: false, reason: 'Not a cash voucher.' };

	const remaining = voucher.amount - voucher.redeemedAmount;
	if (amount <= 0) return { ok: false, reason: 'Amount must be greater than zero.' };
	if (amount > remaining) {
		return { ok: false, reason: `Amount exceeds the ${remaining} remaining on this voucher.` };
	}

	const session = getOpenSession();
	if (!session) {
		return { ok: false, reason: 'No open POS session — open one from the dashboard first.' };
	}

	const fullyDrawn = voucher.redeemedAmount + amount >= voucher.amount;
	const id = uuid();
	db.transaction((tx) => {
		tx.insert(posTransactions)
			.values({
				id,
				type: 'cash_payment',
				title: 'Cash payout',
				subtitle: recipientLabel,
				amount,
				voucherNo: voucher.voucherNo,
				posSessionId: session.id,
				project: voucher.project,
				assignmentId: voucher.assignmentId,
				status: 'pending',
				createdAt: nowIso(),
			})
			.run();

		tx.insert(voucherRedemptions)
			.values({
				id: uuid(),
				voucherId: voucher.id,
				transactionId: id,
				posSessionId: session.id,
				type: 'cash',
				amount,
				redeemedAt: nowIso(),
			})
			.run();

		tx.update(vouchers)
			.set({
				redeemedAmount: voucher.redeemedAmount + amount,
				usesCount: voucher.usesCount + 1,
				status: nextVoucherStatus(voucher, fullyDrawn),
			})
			.where(eq(vouchers.id, voucher.id))
			.run();

		tx.insert(outbox)
			.values({
				id,
				payload: JSON.stringify({
					kind: 'cash_payment',
					voucherNo: voucher.voucherNo,
					amount,
					posSession: session.id,
				}),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
}

// ---- goods / hamper redemption (partial-capable) ----------------------------

export function redeemVoucherGoods(voucherId: string, qty: number): MutationResult {
	const ctx = loadVoucherForRedeem(voucherId);
	if (ctx.error !== undefined) return { ok: false, reason: ctx.error };
	const { voucher, recipientLabel } = ctx;
	if (voucher.entitlementType !== 'hamper' || !voucher.hamperId) {
		return { ok: false, reason: 'Not a hamper voucher.' };
	}

	const totalQty = voucher.qty ?? 0;
	const remaining = totalQty - voucher.redeemedQty;
	if (qty <= 0) return { ok: false, reason: 'Quantity must be at least 1.' };
	if (qty > remaining) {
		return { ok: false, reason: `Quantity exceeds the ${remaining} remaining on this voucher.` };
	}

	const session = getOpenSession();
	if (!session) {
		return { ok: false, reason: 'No open POS session — open one from the dashboard first.' };
	}

	// Goods draw from the session profile's warehouse (stock is per warehouse).
	const profile = db
		.select()
		.from(posProfiles)
		.where(eq(posProfiles.id, session.posProfileId))
		.get();
	if (!profile) return { ok: false, reason: 'POS profile for this session not found.' };

	const stock = db
		.select()
		.from(agentStock)
		.where(and(eq(agentStock.warehouse, profile.warehouse), eq(agentStock.hamperId, voucher.hamperId)))
		.get();
	if (!stock || stock.onHand < qty) {
		return { ok: false, reason: `Not enough stock in ${profile.warehouse}.` };
	}
	const hamper = db.select().from(hampers).where(eq(hampers.id, voucher.hamperId)).get();

	const fullyDrawn = voucher.redeemedQty + qty >= totalQty;
	const id = uuid();
	db.transaction((tx) => {
		tx.insert(posTransactions)
			.values({
				id,
				type: 'goods_issue',
				title: hamper?.name ?? 'Hamper',
				subtitle: recipientLabel,
				qty,
				voucherNo: voucher.voucherNo,
				posSessionId: session.id,
				project: voucher.project,
				assignmentId: voucher.assignmentId,
				status: 'pending',
				createdAt: nowIso(),
			})
			.run();

		tx.update(agentStock)
			.set({
				onHand: sql`${agentStock.onHand} - ${qty}`,
				issuedToday: sql`${agentStock.issuedToday} + ${qty}`,
			})
			.where(
				and(
					eq(agentStock.warehouse, profile.warehouse),
					eq(agentStock.hamperId, voucher.hamperId!),
				),
			)
			.run();

		tx.insert(voucherRedemptions)
			.values({
				id: uuid(),
				voucherId: voucher.id,
				transactionId: id,
				posSessionId: session.id,
				type: 'hamper',
				qty,
				redeemedAt: nowIso(),
			})
			.run();

		tx.update(vouchers)
			.set({
				redeemedQty: voucher.redeemedQty + qty,
				usesCount: voucher.usesCount + 1,
				status: nextVoucherStatus(voucher, fullyDrawn),
			})
			.where(eq(vouchers.id, voucher.id))
			.run();

		tx.insert(outbox)
			.values({
				id,
				payload: JSON.stringify({
					kind: 'goods_issue',
					voucherNo: voucher.voucherNo,
					hamper: voucher.hamperId,
					qty,
					warehouse: profile.warehouse, // Stock Entry source warehouse
					posSession: session.id,
				}),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
}

// ---- stock adjustments ---------------------------------------------------------

function adjustStock(
	warehouse: string,
	hamperId: string,
	qty: number,
	kind: 'return' | 'damaged',
): MutationResult {
	if (qty <= 0) return { ok: false, reason: 'Quantity must be at least 1.' };
	const stock = db
		.select()
		.from(agentStock)
		.where(and(eq(agentStock.warehouse, warehouse), eq(agentStock.hamperId, hamperId)))
		.get();
	if (!stock) return { ok: false, reason: 'Stock line not found.' };
	if (stock.onHand < qty) {
		return { ok: false, reason: `Only ${stock.onHand} on hand.` };
	}
	// Rule 5: every transaction carries a project ref; stock moves aren't
	// voucher-bound, so they ride on the agent's assignment.
	const assignment = db.select().from(assignments).limit(1).get();

	const id = uuid();
	db.transaction((tx) => {
		tx.insert(posTransactions)
			.values({
				id,
				type: 'stock_return',
				title: stock.hamperName,
				subtitle:
					kind === 'return'
						? `Returned ${qty} to central warehouse`
						: `${qty} written off — damaged/expired`,
				qty,
				project: assignment?.project ?? 'General',
				assignmentId: assignment?.id,
				status: 'pending',
				createdAt: nowIso(),
			})
			.run();
		tx.update(agentStock)
			.set({
				onHand: sql`${agentStock.onHand} - ${qty}`,
				...(kind === 'damaged' ? { damaged: sql`${agentStock.damaged} + ${qty}` } : {}),
			})
			.where(and(eq(agentStock.warehouse, warehouse), eq(agentStock.hamperId, hamperId)))
			.run();
		tx.insert(outbox)
			.values({
				id,
				payload: JSON.stringify({ kind: `stock_${kind}`, warehouse, hamper: hamperId, qty }),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
}

export function returnStock(warehouse: string, hamperId: string, qty: number): MutationResult {
	return adjustStock(warehouse, hamperId, qty, 'return');
}

export function reportDamagedStock(
	warehouse: string,
	hamperId: string,
	qty: number,
): MutationResult {
	return adjustStock(warehouse, hamperId, qty, 'damaged');
}

// ---- POS session (opening / closing entry) ---------------------------------------

// Start of shift. Syncs as an ERPNext POS Opening Entry (cash mode, one
// balance row = the opening float).
export function openPosSession(openingFloat: number, posProfileId: string): MutationResult {
	if (openingFloat < 0) return { ok: false, reason: 'Opening float cannot be negative.' };
	if (getOpenSession()) return { ok: false, reason: 'A session is already open.' };

	const profile = db.select().from(posProfiles).where(eq(posProfiles.id, posProfileId)).get();
	if (!profile) return { ok: false, reason: 'POS profile not found on this device.' };

	const id = uuid();
	db.transaction((tx) => {
		tx.insert(posSessions)
			.values({
				id,
				posProfileId: profile.id,
				status: 'open',
				openedAt: nowIso(),
				openingFloat,
			})
			.run();
		tx.insert(outbox)
			.values({
				id,
				payload: JSON.stringify({
					kind: 'pos_opening',
					posProfile: profile.id,
					openingFloat,
				}),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
}

// End of shift. Expected cash = opening float − cash paid out this session
// (a disbursement POS pays cash OUT). Syncs as a POS Closing Entry linked to
// the opening. Omitting countedCash auto-closes at the expected amount — the
// sign-out path uses this so a session is never left dangling; the payload is
// flagged so the backend/admin can tell counted from assumed.
export function closePosSession(countedCash?: number): MutationResult {
	const session = getOpenSession();
	if (!session) return { ok: false, reason: 'No open session to close.' };
	if (countedCash !== undefined && countedCash < 0) {
		return { ok: false, reason: 'Counted cash cannot be negative.' };
	}

	const cashRows = db
		.select({ amount: posTransactions.amount })
		.from(posTransactions)
		.where(
			and(
				eq(posTransactions.posSessionId, session.id),
				eq(posTransactions.type, 'cash_payment'),
			),
		)
		.all();
	const paidOut = cashRows.reduce((s, r) => s + (r.amount ?? 0), 0);
	const expectedCash = session.openingFloat - paidOut;
	const autoClosed = countedCash === undefined;
	const counted = countedCash ?? expectedCash;

	const closeId = uuid();
	db.transaction((tx) => {
		tx.update(posSessions)
			.set({
				status: 'closed',
				closedAt: nowIso(),
				expectedCash,
				countedCash: counted,
			})
			.where(eq(posSessions.id, session.id))
			.run();
		tx.insert(outbox)
			.values({
				id: closeId,
				payload: JSON.stringify({
					kind: 'pos_closing',
					session: session.id,
					openingFloat: session.openingFloat,
					paidOut,
					expectedCash,
					countedCash: counted,
					difference: counted - expectedCash,
					autoClosed,
				}),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: closeId };
}
