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
import type { ClosingPhoto } from '@/services/api';
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

// The open shift plus the POS Opening Entry name every redemption in it is
// stamped with. That name is the backend's shift key: the POS Closing Entry
// autofills its Linked Redemptions from submitted redemptions sharing it, so a
// redemption without it never appears on the shift it belongs to.
//
// A local shift never outlives a failed opening push — openPosSession is rolled
// back when the POS Opening Entry doesn't reach the server (AGENTS.md rule 2,
// shift boundaries are online-only) — so an open session always has its name.
// The second check is a belt on that invariant, not an expected path: refusing
// to redeem is right when we can't say which shift the redemption belongs to.
// Also resolves the shift's POS profile: its warehouse is the working context
// every redemption is scoped to — the stock goods leave from, and the warehouse
// a voucher must belong to before it can be issued here.
function requireOpenSession():
	| { error: string; session?: never; openingEntry?: never; profile?: never }
	| {
			error?: undefined;
			session: typeof posSessions.$inferSelect;
			openingEntry: string;
			profile: typeof posProfiles.$inferSelect;
	  } {
	const session = getOpenSession();
	if (!session) {
		return { error: 'No open POS session — open one from the dashboard first.' };
	}
	if (!session.openingServerName) {
		return {
			error: 'This shift never reached the server. Close it and reopen while online.',
		};
	}
	const profile = db
		.select()
		.from(posProfiles)
		.where(eq(posProfiles.id, session.posProfileId))
		.get();
	if (!profile) return { error: 'POS profile for this session not found.' };
	return { session, openingEntry: session.openingServerName, profile };
}

type VoucherContext =
	| { error: string; voucher?: never }
	| { error?: undefined; voucher: typeof vouchers.$inferSelect; recipientLabel: string };

// Load a voucher and validate it is redeemable (status, validity, use count,
// and that it belongs to the warehouse being worked). Shared by the cash and
// goods redemption paths.
function loadVoucherForRedeem(voucherId: string, sessionWarehouse: string): VoucherContext {
	const voucher = db.select().from(vouchers).where(eq(vouchers.id, voucherId)).get();
	if (!voucher) return { error: 'Voucher not found.' } as const;

	// The device holds the vouchers of every profile the agent can work under, so
	// a voucher reachable by search is not necessarily redeemable HERE. Issuing it
	// against the open shift would post the redemption to the wrong warehouse.
	if (voucher.warehouse && voucher.warehouse !== sessionWarehouse) {
		return {
			error: `This voucher belongs to ${voucher.warehouse}. Switch to that POS profile to redeem it.`,
		} as const;
	}

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
	// Shift first: its profile's warehouse is what the voucher is validated
	// against, so a voucher from another profile can never be paid out here.
	const shift = requireOpenSession();
	if (shift.error !== undefined) return { ok: false, reason: shift.error };
	const { session, openingEntry, profile } = shift;

	const ctx = loadVoucherForRedeem(voucherId, profile.warehouse);
	if (ctx.error !== undefined) return { ok: false, reason: ctx.error };
	const { voucher, recipientLabel } = ctx;
	if (voucher.entitlementType !== 'cash') return { ok: false, reason: 'Not a cash voucher.' };

	const remaining = voucher.amount - voucher.redeemedAmount;
	if (amount <= 0) return { ok: false, reason: 'Amount must be greater than zero.' };
	if (amount > remaining) {
		return { ok: false, reason: `Amount exceeds the ${remaining} remaining on this voucher.` };
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
				warehouse: profile.warehouse,
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
				posOpeningEntry: openingEntry,
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
					posSession: openingEntry,
				}),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
}

// ---- goods / hamper redemption (partial-capable) ----------------------------

export function redeemVoucherGoods(voucherId: string, qty: number): MutationResult {
	// Goods draw from the session profile's warehouse (stock is per warehouse),
	// so the shift is resolved first and the voucher validated against it.
	const shift = requireOpenSession();
	if (shift.error !== undefined) return { ok: false, reason: shift.error };
	const { session, openingEntry, profile } = shift;

	const ctx = loadVoucherForRedeem(voucherId, profile.warehouse);
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
				warehouse: profile.warehouse,
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
				posOpeningEntry: openingEntry,
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
					posSession: openingEntry,
				}),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
}

// ---- stock returns ---------------------------------------------------------

// Send units back to the central warehouse. This is the ONLY stock adjustment
// the POS makes: damaged or lost goods are deliberately out of scope — they go
// through AIGT's procurement process (the collection point reports it and
// procurement handles the replacement and any related costs), not through a
// write-off here. A hamper is also rarely damaged as a whole; it is usually one
// component, which this app has no way to express.
export function returnStock(warehouse: string, hamperId: string, qty: number): MutationResult {
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
				subtitle: `Returned ${qty} to central warehouse`,
				qty,
				warehouse,
				project: assignment?.project ?? 'General',
				assignmentId: assignment?.id,
				status: 'pending',
				createdAt: nowIso(),
			})
			.run();
		tx.update(agentStock)
			.set({ onHand: sql`${agentStock.onHand} - ${qty}` })
			.where(and(eq(agentStock.warehouse, warehouse), eq(agentStock.hamperId, hamperId)))
			.run();
		tx.insert(outbox)
			.values({
				id,
				payload: JSON.stringify({ kind: 'stock_return', warehouse, hamper: hamperId, qty }),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
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

// Undo an opening whose POS Opening Entry never reached the server, so a local
// shift never exists without its backend counterpart. Everything recorded in a
// shift is attributed to that entry (`pos_opening_entry` on each redemption,
// which the closing entry groups by), so a shift the server doesn't know about
// can only produce work nothing can account for — better to not start it.
//
// Only ever called immediately after a failed opening push. Refuses once the
// entry exists or anything has been recorded, so it can't be turned into a way
// to erase a real shift.
//
// A push that was applied but whose response was lost leaves an orphan opening
// on the server; the next open sweeps it up (`_close_stale_openings` in
// nppos/sync_handlers.py closes it with a proper closing entry).
export function discardUnsyncedPosSession(sessionId: string): MutationResult {
	const session = db.select().from(posSessions).where(eq(posSessions.id, sessionId)).get();
	if (!session) return { ok: false, reason: 'Session not found.' };
	if (session.openingServerName) {
		return { ok: false, reason: 'This session is already on the server.' };
	}
	const recorded = db
		.select({ id: posTransactions.id })
		.from(posTransactions)
		.where(eq(posTransactions.posSessionId, sessionId))
		.limit(1)
		.get();
	if (recorded) {
		return { ok: false, reason: 'This session already has recorded transactions.' };
	}

	db.transaction((tx) => {
		// The opening's outbox row is keyed by the session id (written at open).
		tx.delete(outbox).where(eq(outbox.id, sessionId)).run();
		tx.delete(posSessions).where(eq(posSessions.id, sessionId)).run();
	});
	return { ok: true, transactionId: sessionId };
}

// End of shift. Expected cash = opening float − cash paid out this session
// (a disbursement POS pays cash OUT). Syncs as a POS Closing Entry linked to
// the opening. Omitting countedCash auto-closes at the expected amount — the
// sign-out path uses this so a session is never left dangling; the payload is
// flagged so the backend/admin can tell counted from assumed.
//
// `photo` is optional proof-of-distribution the agent captures at close (a
// signed sheet or fingerprint slip). It rides in the outbox payload as base64
// and the backend attaches it to the POS Closing Entry; the local file uri is
// kept on the session row so the closed shift can still show what was sent.
export function closePosSession(
	countedCash?: number,
	photo?: ClosingPhoto & { uri: string },
): MutationResult {
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
				closingPhotoUri: photo?.uri ?? null,
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
					...(photo
						? { photo: { name: photo.name, mime: photo.mime, data: photo.data } }
						: {}),
				}),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: closeId };
}
