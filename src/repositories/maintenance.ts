// Setting 2: keep the local transaction history bounded so a long-lived device
// doesn't grow without limit. Runs after every successful sync
// (features/sync/engine.ts), never on a write path.
//
// Only rows the server already holds are candidates:
// - `pending` rows are still in the outbox — deleting one loses the work.
// - `conflict` rows are waiting for an admin — they are the review queue.
// - rows of the OPEN session are what the reconciliation screen counts.
// Vouchers, stock and sessions are never pruned: a voucher's uses/remaining
// come from the server, so old history rows are not needed for correctness.

import { db } from '@/db/client';
import { posSessions, posTransactions, voucherRedemptions } from '@/db/schema';
import { and, asc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';

// Returns how many transactions were deleted (0 when the rule is off or the
// device is under the cap).
export function pruneSyncedTransactions(keep: number): number {
	if (keep <= 0) return 0;

	const total = db.select({ n: sql<number>`count(*)` }).from(posTransactions).get()?.n ?? 0;
	const excess = total - keep;
	if (excess <= 0) return 0;

	const open = db
		.select({ id: posSessions.id })
		.from(posSessions)
		.where(eq(posSessions.status, 'open'))
		.get();
	const notInOpenSession = open
		? or(isNull(posTransactions.posSessionId), ne(posTransactions.posSessionId, open.id))
		: undefined;

	// Oldest first, and only as many as the device is over the cap — so
	// protected rows (pending/conflict/open shift) simply keep the total above
	// `keep` rather than forcing anything else out.
	const victims = db
		.select({ id: posTransactions.id })
		.from(posTransactions)
		.where(and(eq(posTransactions.status, 'synced'), notInOpenSession))
		.orderBy(asc(posTransactions.createdAt))
		.limit(excess)
		.all()
		.map((r) => r.id);
	if (victims.length === 0) return 0;

	db.transaction((tx) => {
		// Redemption rows reference the transaction, so they go first.
		tx.delete(voucherRedemptions).where(inArray(voucherRedemptions.transactionId, victims)).run();
		tx.delete(posTransactions).where(inArray(posTransactions.id, victims)).run();
	});
	return victims.length;
}
