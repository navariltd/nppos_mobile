// Dev-only seeding: copies the dummy data from src/data/mock.ts into SQLite so
// screens can run on live queries. Runs once per install (skips if the vouchers
// table has rows). Delete the app to reseed.

import * as mock from '@/data/mock';

import { db } from './client';
import {
	agentStock,
	assignments,
	beneficiaries,
	bomItems,
	boms,
	hamperItems,
	hampers,
	outbox as outboxTable,
	posProfiles,
	posTransactions,
	vouchers,
} from './schema';

export function seedIfEmpty(): void {
	const existing = db.select({ id: vouchers.id }).from(vouchers).limit(1).all();
	if (existing.length > 0) return;

	db.transaction((tx) => {
		tx.insert(posProfiles).values(mock.posProfiles).run();

		tx.insert(assignments)
			.values(
				mock.assignments.map((a) => ({
					id: a.id,
					agentId: a.agentId,
					project: a.project,
					disbursementOrder: a.disbursementOrder,
					date: a.date,
					amountToDisburse: a.amountToDisburse,
				})),
			)
			.run();

		tx.insert(boms)
			.values(
				mock.boms.map((b) => ({
					id: b.id,
					itemCode: b.itemCode,
					itemName: b.itemName,
					quantity: b.quantity,
					uom: b.uom,
				})),
			)
			.run();

		tx.insert(bomItems)
			.values(
				mock.boms.flatMap((b) =>
					b.items.map((i) => ({
						bomId: b.id,
						itemCode: i.itemCode,
						itemName: i.itemName,
						unit: i.unit,
						qty: i.qty,
					})),
				),
			)
			.run();

		tx.insert(beneficiaries)
			.values(
				mock.beneficiaries.map((b) => ({
					id: b.id,
					fullName: b.fullName,
					idNumber: b.idNumber,
					status: b.status,
					phone: b.phone,
					householdSize: b.householdSize,
					beneficiaryType: b.beneficiaryType,
					district: b.district,
				})),
			)
			.run();

		tx.insert(hampers)
			.values(mock.hampers.map((h) => ({ id: h.id, name: h.name })))
			.run();

		tx.insert(hamperItems)
			.values(
				mock.hampers.flatMap((h) =>
					h.items.map((i) => ({
						hamperId: h.id,
						itemName: i.itemName,
						unit: i.unit,
						qtyPerHousehold: i.qtyPerHousehold,
					})),
				),
			)
			.run();

		tx.insert(vouchers)
			.values(
				mock.vouchers.map((v) => ({
					id: v.id,
					voucherNo: v.voucherNo,
					beneficiaryNo: v.beneficiaryNo,
					entitlementType: v.entitlementType,
					amount: v.amount,
					hamperId: v.hamperId,
					bomId: v.bomId,
					qty: v.qty,
					uom: v.uom,
					rate: v.rate,
					redeemedAmount: v.redeemedAmount,
					redeemedQty: v.redeemedQty,
					validFrom: v.validFrom,
					validTo: v.validTo,
					status: v.status,
					usesCount: v.usesCount,
					maxUses: v.maxUses,
					project: v.project,
					warehouse: v.warehouse,
					assignmentId: v.assignmentId,
				})),
			)
			.run();

		tx.insert(agentStock).values(mock.agentStock).run();

		tx.insert(posTransactions)
			.values(
				mock.transactions.map((t) => ({
					id: t.id,
					type: t.type,
					title: t.title,
					subtitle: t.subtitle,
					amount: t.amount,
					qty: t.qty,
					beneficiaryName: t.beneficiaryName,
					voucherNo: t.voucherNo,
					warehouse: t.warehouse,
					project: t.project,
					assignmentId: t.assignmentId,
					status: t.status,
					createdAt: t.createdAt,
					serverName: t.serverName,
				})),
			)
			.run();

		// pending transactions always have a matching outbox row (AGENTS.md rule 3)
		const pending = mock.transactions.filter((t) => t.status === 'pending');
		if (pending.length > 0) {
			tx.insert(outboxTable)
				.values(
					pending.map((t) => ({
						id: t.id,
						payload: JSON.stringify({ kind: t.type, seeded: true }),
						createdAt: t.createdAt,
					})),
				)
				.run();
		}
	});
}
