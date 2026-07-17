// All local writes. Each mutation follows AGENTS.md hard rules: one SQLite
// transaction writing the domain row(s) plus an outbox row keyed by a client
// UUID; voucher limit/validity is validated here at issue time. Screens get a
// plain { ok } | { ok: false, reason } result to surface.
//
// The card flow is the exception: online-only, no outbox (rule 2) — it records
// as already-synced since the bank transfer happens in real time (stubbed).

import { db } from '@/db/client';
import {
	agentStock,
	beneficiaries,
	disbursementOrders,
	entitlements,
	hampers,
	outbox,
	posTransactions,
	vouchers,
} from '@/db/schema';
import { uuid } from '@/lib/uuid';
import { eq, sql } from 'drizzle-orm';

export type MutationResult = { ok: true; transactionId: string } | { ok: false; reason: string };

function nowIso(): string {
	return new Date().toISOString();
}

function today(): string {
	return nowIso().slice(0, 10);
}

type IssueContext =
	| { error: string; ent?: never }
	| {
			error?: undefined;
			ent: typeof entitlements.$inferSelect;
			beneficiary: typeof beneficiaries.$inferSelect | undefined;
			voucher: typeof vouchers.$inferSelect | undefined;
			recipientLabel: string;
	  };

// Load an entitlement with the rows an issue touches. Shared by cash/goods/card.
function loadIssueContext(entitlementId: string): IssueContext {
	const ent = db.select().from(entitlements).where(eq(entitlements.id, entitlementId)).get();
	if (!ent) return { error: 'Entitlement not found.' } as const;
	if (ent.status !== 'available') return { error: 'Entitlement already issued.' } as const;

	const beneficiary = ent.beneficiaryId
		? db.select().from(beneficiaries).where(eq(beneficiaries.id, ent.beneficiaryId)).get()
		: undefined;
	const voucher = ent.voucherId
		? db.select().from(vouchers).where(eq(vouchers.id, ent.voucherId)).get()
		: undefined;

	if (voucher) {
		if (voucher.status !== 'active') {
			return {
				error:
					voucher.status === 'exhausted'
						? `Voucher has reached its ${voucher.maxUses}-use limit.`
						: 'Voucher is outside its validity window.',
			} as const;
		}
		if (voucher.usesCount >= voucher.maxUses) {
			return { error: `Voucher has reached its ${voucher.maxUses}-use limit.` } as const;
		}
		const day = today();
		if (day < voucher.validFrom || day > voucher.validTo) {
			return { error: 'Voucher is outside its validity window.' } as const;
		}
	}

	const recipientLabel = beneficiary
		? `${beneficiary.name} · ${beneficiary.beneficiaryNo}`
		: voucher
			? `Voucher ${voucher.voucherNo}`
			: '—';

	return { ent, beneficiary, voucher, recipientLabel } as const;
}

// Shared tail: voucher bump, beneficiary stamp, DO counter, outbox row.
// Runs inside the caller's transaction.
function applyIssueSideEffects(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	ctx: Extract<IssueContext, { error?: undefined }>,
	txnId: string,
	payload: Record<string, unknown>,
	withOutbox = true,
) {
	const { ent, beneficiary, voucher } = ctx;

	tx.update(entitlements)
		.set({ status: 'issued' })
		.where(eq(entitlements.id, ent.id))
		.run();

	if (voucher) {
		const uses = voucher.usesCount + 1;
		tx.update(vouchers)
			.set({ usesCount: uses, status: uses >= voucher.maxUses ? 'exhausted' : voucher.status })
			.where(eq(vouchers.id, voucher.id))
			.run();
	}

	if (beneficiary) {
		tx.update(beneficiaries)
			.set({ lastIssuedAt: nowIso() })
			.where(eq(beneficiaries.id, beneficiary.id))
			.run();
	}

	tx.update(disbursementOrders)
		.set({ issuedCount: sql`${disbursementOrders.issuedCount} + 1` })
		.where(eq(disbursementOrders.id, ent.disbursementOrderId))
		.run();

	if (withOutbox) {
		tx.insert(outbox)
			.values({ id: txnId, payload: JSON.stringify(payload), createdAt: nowIso() })
			.run();
	}
}

// ---- cash payout (beneficiary or voucher entitlement) -----------------------

export function issueCashEntitlement(entitlementId: string): MutationResult {
	const ctx = loadIssueContext(entitlementId);
	if (ctx.error !== undefined) return { ok: false, reason: ctx.error };
	const { ent, beneficiary, voucher, recipientLabel } = ctx;
	if (ent.type !== 'cash') return { ok: false, reason: 'Not a cash entitlement.' };

	const id = uuid();
	db.transaction((tx) => {
		tx.insert(posTransactions)
			.values({
				id,
				type: 'cash_payment',
				title: 'Cash payout',
				subtitle: recipientLabel,
				amount: ent.amount ?? 0,
				beneficiaryId: beneficiary?.id,
				beneficiaryName: beneficiary?.name,
				voucherNo: voucher?.voucherNo,
				entitlementId: ent.id,
				projectId: ent.projectId,
				disbursementOrderId: ent.disbursementOrderId,
				status: 'pending',
				createdAt: nowIso(),
			})
			.run();
		applyIssueSideEffects(tx, ctx, id, {
			kind: 'cash_payment',
			entitlement: ent.id,
			amount: ent.amount,
			voucherNo: voucher?.voucherNo,
			beneficiary: beneficiary?.id,
		});
	});
	return { ok: true, transactionId: id };
}

// ---- goods / hamper issue ----------------------------------------------------

export function issueGoodsEntitlement(entitlementId: string): MutationResult {
	const ctx = loadIssueContext(entitlementId);
	if (ctx.error !== undefined) return { ok: false, reason: ctx.error };
	const { ent, beneficiary, voucher, recipientLabel } = ctx;
	if (ent.type !== 'hamper' || !ent.hamperId) {
		return { ok: false, reason: 'Not a hamper entitlement.' };
	}

	const qty = ent.qty ?? 1;
	const stock = db.select().from(agentStock).where(eq(agentStock.hamperId, ent.hamperId)).get();
	if (!stock || stock.onHand < qty) {
		return { ok: false, reason: 'Not enough stock in your warehouse.' };
	}
	const hamper = db.select().from(hampers).where(eq(hampers.id, ent.hamperId)).get();

	const id = uuid();
	db.transaction((tx) => {
		tx.insert(posTransactions)
			.values({
				id,
				type: 'goods_issue',
				title: hamper?.name ?? 'Hamper',
				subtitle: recipientLabel,
				qty,
				beneficiaryId: beneficiary?.id,
				beneficiaryName: beneficiary?.name,
				voucherNo: voucher?.voucherNo,
				entitlementId: ent.id,
				projectId: ent.projectId,
				disbursementOrderId: ent.disbursementOrderId,
				status: 'pending',
				createdAt: nowIso(),
			})
			.run();
		tx.update(agentStock)
			.set({
				onHand: sql`${agentStock.onHand} - ${qty}`,
				issuedToday: sql`${agentStock.issuedToday} + ${qty}`,
			})
			.where(eq(agentStock.hamperId, ent.hamperId!))
			.run();
		applyIssueSideEffects(tx, ctx, id, {
			kind: 'goods_issue',
			entitlement: ent.id,
			hamper: ent.hamperId,
			qty,
			voucherNo: voucher?.voucherNo,
			beneficiary: beneficiary?.id,
		});
	});
	return { ok: true, transactionId: id };
}

// ---- card withdrawal (online-only, real-time — no outbox) --------------------

export function recordCardWithdrawal(entitlementId: string, amount: number): MutationResult {
	const ctx = loadIssueContext(entitlementId);
	if (ctx.error !== undefined) return { ok: false, reason: ctx.error };
	const { ent, beneficiary, recipientLabel } = ctx;
	if (ent.type !== 'card') return { ok: false, reason: 'Not a card entitlement.' };
	if (amount <= 0 || amount > (ent.amount ?? 0)) {
		return { ok: false, reason: 'Amount exceeds the entitled balance.' };
	}

	const id = uuid();
	db.transaction((tx) => {
		tx.insert(posTransactions)
			.values({
				id,
				type: 'card_withdrawal',
				title: 'Card withdrawal',
				subtitle: recipientLabel,
				amount,
				beneficiaryId: beneficiary?.id,
				beneficiaryName: beneficiary?.name,
				entitlementId: ent.id,
				projectId: ent.projectId,
				disbursementOrderId: ent.disbursementOrderId,
				status: 'synced', // bank confirmed in real time (stub)
				createdAt: nowIso(),
				syncedAt: nowIso(),
				serverName: `BANK-${id.slice(0, 8).toUpperCase()}`,
			})
			.run();
		applyIssueSideEffects(
			tx,
			ctx,
			id,
			{},
			false, // real-time flow — nothing to queue
		);
	});
	return { ok: true, transactionId: id };
}

// ---- stock adjustments ---------------------------------------------------------

function adjustStock(
	hamperId: string,
	qty: number,
	kind: 'return' | 'damaged',
): MutationResult {
	if (qty <= 0) return { ok: false, reason: 'Quantity must be at least 1.' };
	const stock = db.select().from(agentStock).where(eq(agentStock.hamperId, hamperId)).get();
	if (!stock) return { ok: false, reason: 'Stock line not found.' };
	if (stock.onHand < qty) {
		return { ok: false, reason: `Only ${stock.onHand} on hand.` };
	}
	// Rule 5: every transaction carries project + DO refs; stock moves aren't
	// entitlement-bound, so they ride on the first open DO for now.
	const doRow = db
		.select()
		.from(disbursementOrders)
		.where(eq(disbursementOrders.status, 'open'))
		.get();
	if (!doRow) return { ok: false, reason: 'No open disbursement order.' };

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
				projectId: doRow.projectId,
				disbursementOrderId: doRow.id,
				status: 'pending',
				createdAt: nowIso(),
			})
			.run();
		tx.update(agentStock)
			.set({
				onHand: sql`${agentStock.onHand} - ${qty}`,
				...(kind === 'damaged' ? { damaged: sql`${agentStock.damaged} + ${qty}` } : {}),
			})
			.where(eq(agentStock.hamperId, hamperId))
			.run();
		tx.insert(outbox)
			.values({
				id,
				payload: JSON.stringify({ kind: `stock_${kind}`, hamper: hamperId, qty }),
				createdAt: nowIso(),
			})
			.run();
	});
	return { ok: true, transactionId: id };
}

export function returnStock(hamperId: string, qty: number): MutationResult {
	return adjustStock(hamperId, qty, 'return');
}

export function reportDamagedStock(hamperId: string, qty: number): MutationResult {
	return adjustStock(hamperId, qty, 'damaged');
}

// ---- dev-only sync stub ---------------------------------------------------------

// Pretends the sync engine flushed the outbox: pending → synced with a fake
// server doc name. Replaced by the real engine (ARCHITECTURE.md §4) later.
export function simulateSyncFlush(): number {
	const pending = db
		.select()
		.from(posTransactions)
		.where(eq(posTransactions.status, 'pending'))
		.all();

	db.transaction((tx) => {
		for (const t of pending) {
			const prefix =
				t.type === 'cash_payment' ? 'ACC-PAY-2026-' : t.type === 'card_withdrawal' ? 'BANK-' : 'MAT-STE-2026-';
			tx.update(posTransactions)
				.set({
					status: 'synced',
					syncedAt: nowIso(),
					serverName: `${prefix}${String(Math.floor(Math.random() * 90000) + 10000)}`,
				})
				.where(eq(posTransactions.id, t.id))
				.run();
			tx.delete(outbox).where(eq(outbox.id, t.id)).run();
		}
	});
	return pending.length;
}
