// Dev-only seeding: copies the dummy data from src/data/mock.ts into SQLite so
// screens can migrate to live queries without inventing new fixtures. Runs once
// per install (skips if projects table has rows). Delete the app to reseed.

import * as mock from '@/data/mock';

import { db } from './client';
import {
	agentStock,
	assignments,
	beneficiaries,
	disbursementOrders,
	entitlements,
	hamperItems,
	hampers,
	outbox as outboxTable,
	posProfiles,
	posTransactions,
	projects,
	vouchers,
} from './schema';

export function seedIfEmpty(): void {
	const existing = db.select({ id: projects.id }).from(projects).limit(1).all();
	if (existing.length > 0) return;

	db.transaction((tx) => {
		tx.insert(projects).values(mock.projects).run();

		tx.insert(disbursementOrders)
			.values(
				mock.disbursementOrders.map((d) => ({
					id: d.id,
					name: d.name,
					projectId: d.projectId,
					status: d.status,
					totalBeneficiaries: d.totalBeneficiaries,
					issuedCount: d.issuedCount,
				})),
			)
			.run();

		tx.insert(posProfiles).values(mock.posProfiles).run();

		// mock.ts has no assignments export; beneficiaries point at ASG-01
		tx.insert(assignments)
			.values({
				id: 'ASG-01',
				disbursementOrderId: 'DO-2026-0007',
				agentId: mock.currentAgent.id,
				date: '2026-07-01',
				amountToDisburse: 10500,
			})
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

		tx.insert(beneficiaries)
			.values(
				mock.beneficiaries.map((b) => ({
					id: b.id,
					beneficiaryNo: b.beneficiaryNo,
					name: b.name,
					nationalId: b.nationalId,
					phone: b.phone,
					householdSize: b.householdSize,
					projectId: b.projectId,
					assignmentId: b.assignmentId,
					lastIssuedAt: b.lastIssuedAt,
				})),
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
					validFrom: v.validFrom,
					validTo: v.validTo,
					status: v.status,
					usesCount: v.usesCount,
					maxUses: v.maxUses,
					projectId: v.projectId,
					disbursementOrderId: v.disbursementOrderId,
				})),
			)
			.run();

		tx.insert(entitlements)
			.values(
				mock.entitlements.map((e) => ({
					id: e.id,
					type: e.type,
					hamperId: e.hamperId,
					qty: e.qty,
					amount: e.amount,
					status: e.status,
					beneficiaryId: e.beneficiaryId,
					voucherId: e.voucherId,
					projectId: e.projectId,
					disbursementOrderId: e.disbursementOrderId,
				})),
			)
			.run();

		tx.insert(agentStock).values(mock.agentStock).run();

		tx.insert(posTransactions)
			.values(
				mock.transactions.map((t) => ({
					id: t.id,
					type: t.type,
					beneficiaryId: mock.beneficiaries.find((b) => b.name === t.beneficiaryName)?.id,
					title: t.title,
					subtitle: t.subtitle,
					amount: t.amount,
					qty: t.qty,
					beneficiaryName: t.beneficiaryName,
					voucherNo: t.voucherNo,
					projectId: t.projectId,
					disbursementOrderId: t.disbursementOrderId,
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
