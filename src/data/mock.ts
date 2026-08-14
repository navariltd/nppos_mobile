// Dummy data for the "feel the app" phase. Seeded into SQLite by src/db/seed.ts.
// The app mirrors the nppos web POS: an agent works vouchers (Entitlement
// Vouchers, entitlement folded inline) and records redemptions. Projects/DOs are
// back-office hierarchy the agent never sees — only the ADA (assignment) and the
// vouchers reach the device.

import type {
	Agent,
	AgentStockRow,
	Assignment,
	Beneficiary,
	Bom,
	Hamper,
	PosProfile,
	PosTransaction,
	Voucher,
} from '@/types/domain';

export const currentAgent: Agent = {
	id: 'AGT-014',
	name: 'Amina Wanjiru',
	email: 'amina.wanjiru@nppos.org',
	code: 'WH-NRB-014',
	role: 'agent',
	region: 'Nairobi — Kibra',
};

// POS profiles the agent can work under — each binds to one warehouse
// (backend: ERPNext POS Profile with enable_entitlement_distribution).
// Switching profiles switches the stock view to that warehouse.
export const posProfiles: PosProfile[] = [
	{
		id: 'POSP-001',
		name: 'Kibra Field POS',
		agentId: 'AGT-014',
		warehouse: 'WH-NRB-014',
		currency: 'SDG',
	},
	{
		id: 'POSP-002',
		name: 'Kibra Outreach POS',
		agentId: 'AGT-014',
		warehouse: 'WH-NRB-OUT-01',
		currency: 'SDG',
	},
];

// The agent's own slice (ADA). project/disbursementOrder are plain name strings.
export const assignments: Assignment[] = [
	{
		id: 'ASG-01',
		agentId: 'AGT-014',
		project: 'HDR Jun 2026 — Food & Cash',
		disbursementOrder: 'DO-2026-0007',
		date: '2026-07-01',
		amountToDisburse: 10500,
	},
];

// What a hamper contains (backend: BOM + BOM Item). A goods voucher names its
// own BOM, so BOM-A-JUN is what the agent hands over for VCH-4 even though the
// item HMP-A also has a default BOM.
export const boms: Bom[] = [
	{
		id: 'BOM-HMP-A-001',
		itemCode: 'HMP-A',
		itemName: 'Food Basket A',
		quantity: 1,
		uom: 'Nos',
		items: [
			{ itemCode: 'RICE', itemName: 'Rice', unit: 'kg', qty: 10 },
			{ itemCode: 'OIL', itemName: 'Cooking Oil', unit: 'L', qty: 3 },
			{ itemCode: 'BEANS', itemName: 'Beans', unit: 'kg', qty: 5 },
			{ itemCode: 'SALT', itemName: 'Salt', unit: 'kg', qty: 1 },
			{ itemCode: 'FLOUR', itemName: 'Maize Flour', unit: 'kg', qty: 12 },
		],
	},
	{
		id: 'BOM-HMP-B-001',
		itemCode: 'HMP-B',
		itemName: 'Hygiene Basket B',
		quantity: 1,
		uom: 'Nos',
		items: [
			{ itemCode: 'SOAP', itemName: 'Soap', unit: 'bars', qty: 6 },
			{ itemCode: 'PADS', itemName: 'Sanitary Pads', unit: 'packs', qty: 4 },
			{ itemCode: 'PASTE', itemName: 'Toothpaste', unit: 'tubes', qty: 2 },
		],
	},
];

export const hampers: Hamper[] = [
	{
		id: 'HMP-A',
		name: 'Project 1-Jun-2026-Food Basket A',
		bomId: 'BOM-HMP-A-001',
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
		bomId: 'BOM-HMP-B-001',
		items: [
			{ itemName: 'Soap', unit: 'bars', qtyPerHousehold: 6 },
			{ itemName: 'Sanitary Pads', unit: 'packs', qtyPerHousehold: 4 },
			{ itemName: 'Toothpaste', unit: 'tubes', qtyPerHousehold: 2 },
		],
	},
];

const PROJECT = 'HDR Jun 2026 — Food & Cash';

// The people behind the vouchers — what an agent needs to confirm identity at
// the distribution point (backend: Beneficiary in aigt_hdr).
export const beneficiaries: Beneficiary[] = [
	{
		id: 'B-9001',
		fullName: 'Fatima Ahmed Osman',
		idNumber: '29874112',
		status: 'Active',
		phone: '+249 91 234 5678',
		householdSize: 6,
		beneficiaryType: 'Household',
		district: 'Kibra',
	},
	{
		id: 'B-9042',
		fullName: 'Joseph Kamau Njoroge',
		idNumber: '31220984',
		status: 'Active',
		phone: '+249 92 887 1120',
		householdSize: 4,
		beneficiaryType: 'Household',
		district: 'Kibra',
	},
	{
		id: 'B-9077',
		fullName: 'Amal Ibrahim Hassan',
		idNumber: '27551903',
		status: 'Under Review',
		phone: '+249 90 445 7781',
		householdSize: 8,
		beneficiaryType: 'Household',
		district: 'Kibra',
	},
];

// Each voucher carries ONE entitlement inline — a cash amount OR a hamper qty —
// mirroring the backend's Entitlement Voucher (Goods|Cash).
export const vouchers: Voucher[] = [
	// Cash voucher — the happy path for partial redemption demos.
	{
		id: 'VCH-1',
		voucherNo: 'V-2026-88231',
		beneficiaryNo: 'B-9001',
		entitlementType: 'cash',
		amount: 4000,
		redeemedAmount: 0,
		redeemedQty: 0,
		validFrom: '2026-07-01',
		validTo: '2026-07-31',
		status: 'active',
		usesCount: 0,
		maxUses: 2,
		project: PROJECT,
		assignmentId: 'ASG-01',
	},
	// Same beneficiary, but expired — shows up in a beneficiary-no search.
	{
		id: 'VCH-2',
		voucherNo: 'V-2026-88232',
		beneficiaryNo: 'B-9001',
		entitlementType: 'cash',
		amount: 2500,
		redeemedAmount: 0,
		redeemedQty: 0,
		validFrom: '2026-06-01',
		validTo: '2026-06-30',
		status: 'expired',
		usesCount: 0,
		maxUses: 2,
		project: PROJECT,
		assignmentId: 'ASG-01',
	},
	// Fully redeemed cash voucher.
	{
		id: 'VCH-3',
		voucherNo: 'V-2026-88240',
		beneficiaryNo: 'B-9042',
		entitlementType: 'cash',
		amount: 6000,
		redeemedAmount: 6000,
		redeemedQty: 0,
		validFrom: '2026-07-01',
		validTo: '2026-07-31',
		status: 'redeemed',
		usesCount: 2,
		maxUses: 2,
		project: PROJECT,
		assignmentId: 'ASG-01',
	},
	// Goods voucher — redeems as a hamper from the agent's warehouse.
	{
		id: 'VCH-4',
		voucherNo: 'V-2026-88245',
		beneficiaryNo: 'B-9077',
		entitlementType: 'hamper',
		amount: 0,
		hamperId: 'HMP-A',
		bomId: 'BOM-HMP-A-001',
		qty: 2,
		uom: 'Nos',
		rate: 0,
		redeemedAmount: 0,
		redeemedQty: 0,
		validFrom: '2026-07-01',
		validTo: '2026-07-31',
		status: 'active',
		usesCount: 0,
		maxUses: 2,
		project: PROJECT,
		assignmentId: 'ASG-01',
	},
];

export const agentStock: AgentStockRow[] = [
	// Kibra Field POS warehouse
	{ warehouse: 'WH-NRB-014', hamperId: 'HMP-A', hamperName: 'Food Basket A', bomId: 'BOM-HMP-A-001', onHand: 73, issuedToday: 47, damaged: 2 },
	{ warehouse: 'WH-NRB-014', hamperId: 'HMP-B', hamperName: 'Hygiene Basket B', bomId: 'BOM-HMP-B-001', onHand: 40, issuedToday: 8, damaged: 0 },
	// Kibra Outreach POS warehouse — deliberately different so switching
	// profiles visibly switches the stock view.
	{ warehouse: 'WH-NRB-OUT-01', hamperId: 'HMP-A', hamperName: 'Food Basket A', bomId: 'BOM-HMP-A-001', onHand: 18, issuedToday: 3, damaged: 0 },
];

export const transactions: PosTransaction[] = [
	{
		id: 'TXN-9f2a',
		type: 'goods_issue',
		title: 'Food Basket A',
		subtitle: 'B-9077 · V-2026-88250',
		qty: 1,
		voucherNo: 'V-2026-88250',
		project: PROJECT,
		assignmentId: 'ASG-01',
		status: 'synced',
		createdAt: '2026-07-04T09:12:00Z',
		serverName: 'ENT-RED-2026-07-00318',
	},
	{
		id: 'TXN-7c11',
		type: 'cash_payment',
		title: 'Cash payout',
		subtitle: 'Voucher V-2026-88232',
		amount: 2500,
		voucherNo: 'V-2026-88232',
		project: PROJECT,
		assignmentId: 'ASG-01',
		status: 'pending',
		createdAt: '2026-07-04T10:40:00Z',
	},
	{
		id: 'TXN-2a03',
		type: 'cash_payment',
		title: 'Cash payout',
		subtitle: 'Voucher V-2026-88240',
		amount: 2000,
		voucherNo: 'V-2026-88240',
		project: PROJECT,
		assignmentId: 'ASG-01',
		status: 'synced',
		createdAt: '2026-07-04T08:20:00Z',
		serverName: 'ENT-RED-2026-07-00119',
	},
];

// Admin-only: fleet overview
export const agentsOverview: (Agent & { issued: number; target: number; pending: number })[] = [
	{ ...currentAgent, issued: 47, target: 120, pending: 1 },
	{ id: 'AGT-021', name: 'Brian Otieno', email: 'brian.otieno@nppos.org', code: 'WH-NRB-021', role: 'agent', region: 'Nairobi — Mathare', issued: 88, target: 100, pending: 0 },
	{ id: 'AGT-033', name: 'Cynthia Mueni', email: 'cynthia.mueni@nppos.org', code: 'WH-NRB-033', role: 'agent', region: 'Nairobi — Dandora', issued: 12, target: 90, pending: 3 },
];
