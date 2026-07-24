// FrappeAdapter — the real backend, speaking to three whitelisted methods in
// the aigt_hdr Frappe app (the Python side; full contract in docs/SYNC_API.md):
//
//   POST /api/method/aigt_hdr.sync_api.login       { email, password }
//   POST /api/method/aigt_hdr.sync_api.sync_push   { client_ref, created_at, payload }
//   POST /api/method/aigt_hdr.sync_api.sync_pull   { cursors }
//
// Wire format is snake_case (natural for Frappe/Python); this adapter is the
// only place that maps it to the app's camelCase domain types. Auth after
// login is `Authorization: token api_key:api_secret` per request.
//
// Selected automatically by src/services/api/index.ts when
// EXPO_PUBLIC_FRAPPE_URL is set; MockAdapter otherwise.

import type {
	ApiAdapter,
	LoginRequest,
	LoginResponse,
	PullCollection,
	PullCursors,
	PullResponse,
	PushItem,
	PushResult,
} from '../types';
import { ApiError } from '../types';

const REQUEST_TIMEOUT_MS = 20_000;

interface FrappeAgent {
	id: string;
	name: string;
	email: string;
	warehouse_code: string;
	role: 'agent' | 'admin';
	region: string;
}

// sync_pull payload — snake_case rows, shapes documented in docs/SYNC_API.md.
interface FrappePull {
	projects: { id: string; name: string; code: string }[];
	disbursement_orders: {
		id: string;
		name: string;
		project_id: string;
		status: 'open' | 'closed';
		total_beneficiaries: number;
		issued_count: number;
	}[];
	assignments: {
		id: string;
		disbursement_order_id: string;
		agent_id: string;
		date?: string;
		amount_to_disburse: number;
	}[];
	beneficiaries: {
		id: string;
		beneficiary_no: string;
		name: string;
		national_id?: string;
		phone?: string;
		household_size: number;
		project_id: string;
		assignment_id: string;
	}[];
	vouchers: {
		id: string;
		voucher_no: string;
		beneficiary_no?: string;
		entitlement_type: 'cash' | 'hamper';
		amount: number;
		valid_from: string;
		valid_to: string;
		status: 'active' | 'partially_redeemed' | 'redeemed' | 'expired';
		uses_count: number;
		max_uses: number;
		project_id: string;
		disbursement_order_id: string;
	}[];
	entitlements: {
		id: string;
		type: 'hamper' | 'cash' | 'card';
		hamper_id?: string;
		qty?: number;
		amount?: number;
		status: 'available' | 'issued';
		beneficiary_id?: string;
		voucher_id?: string;
		project_id: string;
		disbursement_order_id: string;
	}[];
	hampers: {
		id: string;
		name: string;
		items: { item_name: string; unit: string; qty_per_household: number }[];
	}[];
	agent_stock: {
		warehouse: string;
		hamper_id: string;
		hamper_name: string;
		on_hand: number;
		issued_today: number;
		damaged: number;
	}[];
	pos_profiles: {
		id: string;
		name: string;
		agent_id: string;
		warehouse: string;
		currency: string;
	}[];
	cursors: Record<PullCollection, string>;
}

export class FrappeAdapter implements ApiAdapter {
	private readonly baseUrl: string;
	private token: string | null = null;

	constructor(opts: { baseUrl: string }) {
		this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
	}

	setToken(token: string | null): void {
		this.token = token;
	}

	// POST a whitelisted method; unwrap Frappe's { message } envelope.
	private async call<T>(method: string, body: unknown): Promise<T> {
		const url = `${this.baseUrl}/api/method/${method}`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		const startedAt = Date.now();
		console.log(`[frappe] → POST ${url} (auth=${this.token ? 'yes' : 'no'})`);
		let res: Response;
		try {
			res = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					...(this.token ? { Authorization: `token ${this.token}` } : {}),
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} catch (err) {
			// This is where "Network request failed" comes from — the request
			// never got a response. Log the real cause so it isn't swallowed.
			const aborted = controller.signal.aborted;
			const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
			console.warn(
				`[frappe] ✗ POST ${url} failed after ${Date.now() - startedAt}ms — ` +
					`${aborted ? `timed out (>${REQUEST_TIMEOUT_MS}ms)` : detail}`,
			);
			if (aborted) throw new ApiError(`Request timed out after ${REQUEST_TIMEOUT_MS}ms.`, true);
			throw new ApiError(`Network request failed (${detail}).`, true);
		} finally {
			clearTimeout(timer);
		}

		console.log(`[frappe] ← ${res.status} ${url} (${Date.now() - startedAt}ms)`);
		if (!res.ok) {
			const message = await extractFrappeError(res);
			const retryable = res.status >= 500 || res.status === 429;
			console.warn(`[frappe] ✗ HTTP ${res.status} ${url} — ${message}`);
			throw new ApiError(message, retryable);
		}
		const json = (await res.json()) as { message: T };
		return json.message;
	}

	async login(req: LoginRequest): Promise<LoginResponse> {
		const m = await this.call<{
			token: string;
			agent: FrappeAgent;
			pos_profiles: FrappePull['pos_profiles'];
		}>('aigt_hdr.sync_api.login', {
			email: req.email,
			password: req.password,
		});
		this.token = m.token;
		return {
			token: m.token,
			agent: {
				id: m.agent.id,
				name: m.agent.name,
				email: m.agent.email,
				code: m.agent.warehouse_code,
				role: m.agent.role,
				region: m.agent.region,
			},
			posProfiles: m.pos_profiles.map((p) => ({
				id: p.id,
				name: p.name,
				agentId: p.agent_id,
				warehouse: p.warehouse,
				currency: p.currency,
			})),
		};
	}

	async push(item: PushItem): Promise<PushResult> {
		const m = await this.call<{
			status: 'accepted' | 'rejected';
			server_name?: string;
			reason?: string;
			related?: Record<string, string>;
		}>('aigt_hdr.sync_api.sync_push', {
			client_ref: item.id, // idempotency key (custom_client_ref)
			created_at: item.createdAt,
			payload: item.payload,
		});
		if (m.status === 'accepted') {
			return {
				outcome: 'accepted',
				serverName: m.server_name ?? item.id,
				relatedNames: m.related,
			};
		}
		return { outcome: 'rejected', reason: m.reason ?? 'Rejected by the server.' };
	}

	async pull(cursors: PullCursors): Promise<PullResponse> {
		const m = await this.call<FrappePull>('aigt_hdr.sync_api.sync_pull', { cursors });
		return {
			projects: m.projects,
			disbursementOrders: m.disbursement_orders.map((d) => ({
				id: d.id,
				name: d.name,
				projectId: d.project_id,
				status: d.status,
				totalBeneficiaries: d.total_beneficiaries,
				issuedCount: d.issued_count,
			})),
			assignments: m.assignments.map((a) => ({
				id: a.id,
				disbursementOrderId: a.disbursement_order_id,
				agentId: a.agent_id,
				date: a.date,
				amountToDisburse: a.amount_to_disburse,
			})),
			beneficiaries: m.beneficiaries.map((b) => ({
				id: b.id,
				beneficiaryNo: b.beneficiary_no,
				name: b.name,
				nationalId: b.national_id ?? '',
				phone: b.phone ?? '',
				householdSize: b.household_size,
				projectId: b.project_id,
				assignmentId: b.assignment_id,
			})),
			vouchers: m.vouchers.map((v) => ({
				id: v.id,
				voucherNo: v.voucher_no,
				beneficiaryNo: v.beneficiary_no,
				entitlementType: v.entitlement_type,
				amount: v.amount,
				validFrom: v.valid_from,
				validTo: v.valid_to,
				status: v.status,
				usesCount: v.uses_count,
				maxUses: v.max_uses,
				projectId: v.project_id,
				disbursementOrderId: v.disbursement_order_id,
			})),
			entitlements: m.entitlements.map((e) => ({
				id: e.id,
				type: e.type,
				hamperId: e.hamper_id,
				qty: e.qty,
				amount: e.amount,
				status: e.status,
				beneficiaryId: e.beneficiary_id,
				voucherId: e.voucher_id,
				projectId: e.project_id,
				disbursementOrderId: e.disbursement_order_id,
			})),
			hampers: m.hampers.map((h) => ({
				id: h.id,
				name: h.name,
				items: h.items.map((i) => ({
					itemName: i.item_name,
					unit: i.unit,
					qtyPerHousehold: i.qty_per_household,
				})),
			})),
			agentStock: m.agent_stock.map((s) => ({
				warehouse: s.warehouse,
				hamperId: s.hamper_id,
				hamperName: s.hamper_name,
				onHand: s.on_hand,
				issuedToday: s.issued_today,
				damaged: s.damaged,
			})),
			posProfiles: m.pos_profiles.map((p) => ({
				id: p.id,
				name: p.name,
				agentId: p.agent_id,
				warehouse: p.warehouse,
				currency: p.currency,
			})),
			cursors: m.cursors,
		};
	}
}

// Frappe error responses carry the useful text in different places depending
// on the failure — try them in order of usefulness.
async function extractFrappeError(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as {
			message?: string;
			exception?: string;
			_server_messages?: string;
		};
		if (body._server_messages) {
			try {
				const msgs = JSON.parse(body._server_messages) as string[];
				const first = JSON.parse(msgs[0]) as { message?: string };
				if (first.message) return first.message;
			} catch {
				// fall through to the other fields
			}
		}
		if (body.message) return body.message;
		if (body.exception) return body.exception.split(':').pop()?.trim() ?? body.exception;
	} catch {
		// non-JSON body
	}
	return `Server error (HTTP ${res.status}).`;
}
