// Dummy data for the "feel the app" phase. No SQLite, no adapter, no sync.
// Everything the screens render comes from here. When the real data layer lands
// (see docs/ARCHITECTURE.md §6), these selectors get reimplemented over Drizzle
// repositories / the MockAdapter and the screens shouldn't need to change shape.

import type {
	Agent,
	AgentStockRow,
	Beneficiary,
	DisbursementOrder,
	Entitlement,
	Hamper,
	PosTransaction,
	Project,
	Voucher,
} from '@/types/domain';

export const currentAgent: Agent = {
	id: 'AGT-014',
	name: 'Amina Wanjiru',
	code: 'WH-NRB-014',
	role: 'agent',
	region: 'Nairobi — Kibra',
};

export const projects: Project[] = [
	{ id: 'PRJ-2026-01', name: 'HDR Jun 2026 — Food & Cash', code: 'HDR-JUN26' },
	{ id: 'PRJ-2026-02', name: 'HDR Drought Response', code: 'HDR-DR' },
];

export const disbursementOrders: DisbursementOrder[] = [
	{
		id: 'DO-2026-0007',
		name: 'DO-2026-0007',
		projectId: 'PRJ-2026-01',
		status: 'open',
		totalBeneficiaries: 120,
		issuedCount: 47,
	},
	{
		id: 'DO-2026-0011',
		name: 'DO-2026-0011',
		projectId: 'PRJ-2026-02',
		status: 'open',
		totalBeneficiaries: 60,
		issuedCount: 12,
	},
];

export const hampers: Hamper[] = [
	{
		id: 'HMP-A',
		name: 'Project 1-Jun-2026-Food Basket A',
		items: [
			{ itemName: 'Rice', unit: 'kg', qtyPerHousehold: 10 },
			{ itemName: 'Cooking Oil', unit: 'L', qtyPerHousehold: 3 },
			{ itemName: 'Beans', unit: 'kg', qtyPerHousehold: 5 },
			{ itemName: 'Salt', unit: 'kg', qtyPerHousehold: 1 },
			{ itemName: 'Maize Flour', unit: 'kg', qtyPerHousehold: 12 },
		],
	},
	{
		id: 'HMP-B',
		name: 'Project 1-Jun-2026-Hygiene Basket B',
		items: [
			{ itemName: 'Soap', unit: 'bars', qtyPerHousehold: 6 },
			{ itemName: 'Sanitary Pads', unit: 'packs', qtyPerHousehold: 4 },
			{ itemName: 'Toothpaste', unit: 'tubes', qtyPerHousehold: 2 },
		],
	},
];

export const entitlements: Entitlement[] = [
	// Grace Otieno — hamper + cash
	{
		id: 'ENT-001',
		type: 'hamper',
		hamperId: 'HMP-A',
		qty: 1,
		status: 'available',
		beneficiaryId: 'BEN-1001',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
	{
		id: 'ENT-002',
		type: 'cash',
		amount: 3500,
		status: 'available',
		beneficiaryId: 'BEN-1001',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
	// John Mwangi — hamper only (already issued)
	{
		id: 'ENT-003',
		type: 'hamper',
		hamperId: 'HMP-A',
		qty: 1,
		status: 'issued',
		beneficiaryId: 'BEN-1002',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
	// Fatuma Ali — hygiene + cash
	{
		id: 'ENT-004',
		type: 'hamper',
		hamperId: 'HMP-B',
		qty: 1,
		status: 'available',
		beneficiaryId: 'BEN-1003',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
	{
		id: 'ENT-005',
		type: 'card',
		amount: 5000,
		status: 'available',
		beneficiaryId: 'BEN-1003',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
	// Peter Kamau — cash only
	{
		id: 'ENT-006',
		type: 'cash',
		amount: 2000,
		status: 'available',
		beneficiaryId: 'BEN-1004',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
	// Voucher entitlements (walk-in)
	{
		id: 'ENT-V01',
		type: 'cash',
		amount: 4000,
		status: 'available',
		voucherId: 'VCH-1',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
	{
		id: 'ENT-V02',
		type: 'hamper',
		hamperId: 'HMP-A',
		qty: 1,
		status: 'available',
		voucherId: 'VCH-1',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
	},
];

export const beneficiaries: Beneficiary[] = [
	{
		id: 'BEN-1001',
		beneficiaryNo: 'B-1001',
		name: 'Grace Otieno',
		nationalId: '2938****1',
		phone: '+254 712 345 678',
		householdSize: 5,
		projectId: 'PRJ-2026-01',
		assignmentId: 'ASG-01',
		entitlementIds: ['ENT-001', 'ENT-002'],
	},
	{
		id: 'BEN-1002',
		beneficiaryNo: 'B-1002',
		name: 'John Mwangi',
		nationalId: '1102****4',
		phone: '+254 720 111 222',
		householdSize: 3,
		projectId: 'PRJ-2026-01',
		assignmentId: 'ASG-01',
		entitlementIds: ['ENT-003'],
		lastIssuedAt: '2026-07-04T09:12:00Z',
	},
	{
		id: 'BEN-1003',
		beneficiaryNo: 'B-1003',
		name: 'Fatuma Ali',
		nationalId: '3388****7',
		phone: '+254 733 909 090',
		householdSize: 7,
		projectId: 'PRJ-2026-01',
		assignmentId: 'ASG-01',
		entitlementIds: ['ENT-004', 'ENT-005'],
	},
	{
		id: 'BEN-1004',
		beneficiaryNo: 'B-1004',
		name: 'Peter Kamau',
		nationalId: '4471****2',
		phone: '+254 701 555 333',
		householdSize: 2,
		projectId: 'PRJ-2026-01',
		assignmentId: 'ASG-01',
		entitlementIds: ['ENT-006'],
	},
	{
		id: 'BEN-1005',
		beneficiaryNo: 'B-1005',
		name: 'Mary Njeri',
		nationalId: '5590****9',
		phone: '+254 799 878 787',
		householdSize: 4,
		projectId: 'PRJ-2026-01',
		assignmentId: 'ASG-01',
		entitlementIds: [],
	},
];

export const vouchers: Voucher[] = [
	{
		id: 'VCH-1',
		voucherNo: 'V-2026-88231',
		beneficiaryNo: 'B-9001',
		amount: 4000,
		validFrom: '2026-07-01',
		validTo: '2026-07-31',
		status: 'active',
		usesCount: 0,
		maxUses: 2,
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
		entitlementIds: ['ENT-V01', 'ENT-V02'],
	},
	{
		id: 'VCH-2',
		voucherNo: 'V-2026-88232',
		beneficiaryNo: 'B-9001',
		amount: 2500,
		validFrom: '2026-06-01',
		validTo: '2026-06-30',
		status: 'expired',
		usesCount: 1,
		maxUses: 2,
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
		entitlementIds: [],
	},
	{
		id: 'VCH-3',
		voucherNo: 'V-2026-88240',
		beneficiaryNo: 'B-9042',
		amount: 6000,
		validFrom: '2026-07-01',
		validTo: '2026-07-31',
		status: 'exhausted',
		usesCount: 2,
		maxUses: 2,
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
		entitlementIds: [],
	},
];

export const agentStock: AgentStockRow[] = [
	{ hamperId: 'HMP-A', hamperName: 'Food Basket A', onHand: 73, issuedToday: 47, damaged: 2 },
	{ hamperId: 'HMP-B', hamperName: 'Hygiene Basket B', onHand: 40, issuedToday: 8, damaged: 0 },
];

export const transactions: PosTransaction[] = [
	{
		id: 'TXN-9f2a',
		type: 'goods_issue',
		title: 'Food Basket A',
		subtitle: 'John Mwangi · B-1002',
		qty: 1,
		beneficiaryName: 'John Mwangi',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
		status: 'synced',
		createdAt: '2026-07-04T09:12:00Z',
		serverName: 'MAT-STE-2026-00318',
	},
	{
		id: 'TXN-7c11',
		type: 'cash_payment',
		title: 'Cash payout',
		subtitle: 'Voucher V-2026-88232',
		amount: 2500,
		voucherNo: 'V-2026-88232',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
		status: 'pending',
		createdAt: '2026-07-04T10:40:00Z',
	},
	{
		id: 'TXN-4d88',
		type: 'card_withdrawal',
		title: 'Card withdrawal',
		subtitle: 'Fatuma Ali · B-1003',
		amount: 5000,
		beneficiaryName: 'Fatuma Ali',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
		status: 'conflict',
		createdAt: '2026-07-04T11:02:00Z',
	},
	{
		id: 'TXN-2a03',
		type: 'cash_payment',
		title: 'Cash payout',
		subtitle: 'Peter Kamau · B-1004',
		amount: 2000,
		beneficiaryName: 'Peter Kamau',
		projectId: 'PRJ-2026-01',
		disbursementOrderId: 'DO-2026-0007',
		status: 'synced',
		createdAt: '2026-07-04T08:20:00Z',
		serverName: 'ACC-PAY-2026-00119',
	},
];

// Admin-only: fleet overview
export const agentsOverview: (Agent & { issued: number; target: number; pending: number })[] = [
	{ ...currentAgent, issued: 47, target: 120, pending: 1 },
	{ id: 'AGT-021', name: 'Brian Otieno', code: 'WH-NRB-021', role: 'agent', region: 'Nairobi — Mathare', issued: 88, target: 100, pending: 0 },
	{ id: 'AGT-033', name: 'Cynthia Mueni', code: 'WH-NRB-033', role: 'agent', region: 'Nairobi — Dandora', issued: 12, target: 90, pending: 3 },
];

// ---- selector helpers -----------------------------------------------------

export const getProject = (id: string) => projects.find((p) => p.id === id);
export const getHamper = (id?: string) => hampers.find((h) => h.id === id);
export const getBeneficiary = (id: string) => beneficiaries.find((b) => b.id === id);
export const getEntitlement = (id: string) => entitlements.find((e) => e.id === id);

export const getEntitlementsForBeneficiary = (id: string) =>
	entitlements.filter((e) => e.beneficiaryId === id);

export const getEntitlementsForVoucher = (voucherId: string) =>
	entitlements.filter((e) => e.voucherId === voucherId);

export const findVoucherByNo = (voucherNo: string) =>
	vouchers.find((v) => v.voucherNo.toLowerCase() === voucherNo.trim().toLowerCase());

export const findVouchersByBeneficiaryNo = (beneficiaryNo: string) =>
	vouchers.filter(
		(v) =>
			v.status === 'active' &&
			v.beneficiaryNo?.toLowerCase() === beneficiaryNo.trim().toLowerCase()
	);

export const getVoucher = (id: string) => vouchers.find((v) => v.id === id);
export const getVoucherByNo = (voucherNo: string) =>
	vouchers.find((v) => v.voucherNo === voucherNo);

export const searchBeneficiaries = (q: string) => {
	const query = q.trim().toLowerCase();
	if (!query) return beneficiaries;
	return beneficiaries.filter(
		(b) =>
			b.name.toLowerCase().includes(query) ||
			b.beneficiaryNo.toLowerCase().includes(query)
	);
};

export const beneficiaryTransactions = (beneficiaryId: string) => {
	const b = getBeneficiary(beneficiaryId);
	if (!b) return [];
	return transactions.filter((t) => t.beneficiaryName === b.name);
};

export const pendingCount = () =>
	transactions.filter((t) => t.status === 'pending').length;

export const conflictCount = () =>
	transactions.filter((t) => t.status === 'conflict').length;
