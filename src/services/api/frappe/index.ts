// FrappeAdapter — the real backend, speaking to three whitelisted methods in
// the **nppos** Frappe app (the web POS that owns Entitlement Voucher /
// Entitlement Redemption — NOT aigt_hdr; see docs/NPPOS_WEB.md):
//
//   POST /api/method/nppos.sync_api.login       { email, password }
//   POST /api/method/nppos.sync_api.sync_push   { client_ref, created_at, payload }
//   POST /api/method/nppos.sync_api.sync_pull   { cursors }
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

// sync_pull payload — snake_case rows, shapes documented in docs/NPPOS_WEB.md.
interface FrappePull {
	assignments: {
		id: string;
		agent_id: string;
		project: string;
		disbursement_order?: string;
		date?: string;
		amount_to_disburse: number;
	}[];
	vouchers: {
		id: string;
		voucher_no: string;
		beneficiary_no?: string;
		entitlement_type: 'cash' | 'hamper';
		amount: number;
		hamper_id?: string;
		bom_id?: string;
		qty?: number;
		uom?: string;
		rate?: number;
		redeemed_amount: number;
		redeemed_qty: number;
		valid_from: string;
		valid_to: string;
		status: 'active' | 'partially_redeemed' | 'redeemed' | 'expired';
		uses_count: number;
		max_uses: number;
		project: string;
		warehouse: string;
		assignment_id?: string;
		image?: string; // site-relative QR file url, e.g. /files/QNAK4OWSW-qr.png
	}[];
	boms: {
		id: string;
		item_code: string;
		item_name: string;
		quantity: number;
		uom?: string;
		items: { item_code: string; item_name: string; unit: string; qty: number }[];
	}[];
	hampers: {
		id: string;
		name: string;
		bom_id?: string | null;
		items: { item_name: string; unit: string; qty_per_household: number }[];
	}[];
	agent_stock: {
		warehouse: string;
		hamper_id: string;
		hamper_name: string;
		bom_id?: string | null;
		on_hand: number;
		issued_today: number;
	}[];
	beneficiaries: {
		id: string;
		full_name: string;
		id_number?: string | null;
		status?: string | null;
		phone?: string | null;
		household_size: number;
		beneficiary_type?: string | null;
		district?: string | null;
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
		this.token = null;
		const m = await this.call<{
			token: string;
			agent: FrappeAgent;
			pos_profiles: FrappePull['pos_profiles'];
		}>('nppos.sync_api.login', {
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
		}>('nppos.sync_api.sync_push', {
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
		const m = await this.call<FrappePull>('nppos.sync_api.sync_pull', { cursors });
		return {
			assignments: m.assignments.map((a) => ({
				id: a.id,
				agentId: a.agent_id,
				project: a.project,
				disbursementOrder: a.disbursement_order,
				date: a.date,
				amountToDisburse: a.amount_to_disburse,
			})),
			vouchers: m.vouchers.map((v) => ({
				id: v.id,
				voucherNo: v.voucher_no,
				beneficiaryNo: v.beneficiary_no,
				entitlementType: v.entitlement_type,
				amount: v.amount,
				hamperId: v.hamper_id,
				bomId: v.bom_id || undefined,
				qty: v.qty,
				uom: v.uom,
				rate: v.rate,
				redeemedAmount: v.redeemed_amount,
				redeemedQty: v.redeemed_qty,
				validFrom: v.valid_from,
				validTo: v.valid_to,
				status: v.status,
				usesCount: v.uses_count,
				maxUses: v.max_uses,
				project: v.project,
				warehouse: v.warehouse ?? '',
				assignmentId: v.assignment_id,
				image: v.image || undefined,
			})),
			boms: (m.boms ?? []).map((b) => ({
				id: b.id,
				itemCode: b.item_code,
				itemName: b.item_name,
				quantity: b.quantity,
				uom: b.uom || undefined,
				items: b.items.map((i) => ({
					itemCode: i.item_code,
					itemName: i.item_name,
					unit: i.unit,
					qty: i.qty,
				})),
			})),
			hampers: m.hampers.map((h) => ({
				id: h.id,
				name: h.name,
				bomId: h.bom_id || undefined,
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
				bomId: s.bom_id || null,
				onHand: s.on_hand,
				issuedToday: s.issued_today,
			})),
			beneficiaries: (m.beneficiaries ?? []).map((b) => ({
				id: b.id,
				fullName: b.full_name,
				idNumber: b.id_number || undefined,
				status: b.status || undefined,
				phone: b.phone || undefined,
				householdSize: b.household_size ?? 0,
				beneficiaryType: b.beneficiary_type || undefined,
				district: b.district || undefined,
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
