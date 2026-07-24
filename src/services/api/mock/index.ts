// MockAdapter — the dummy "backend". Simulates network latency, hands out
// fake ERPNext doc names on push (same prefixes the real backend uses), and can
// be dialed to fail or reject so the sync engine's retry/conflict paths get
// exercised before the FrappeAdapter exists.
//
// Pull is intentionally empty: the mock world has no server-side changes — the
// device was seeded directly from src/data/mock.ts. When the FrappeAdapter
// lands, pull() becomes the real delta feed and the seed goes away.

import { currentAgent, posProfiles } from '@/data/mock';
import type {
	ApiAdapter,
	LoginRequest,
	LoginResponse,
	PullCursors,
	PullResponse,
	PushItem,
	PushResult,
} from '../types';
import { ApiError } from '../types';

export interface MockAdapterOptions {
	latencyMs?: number; // per-call simulated round trip
	rejectRate?: number; // 0..1 — chance a push is *validly rejected* (→ conflict)
	failRate?: number; // 0..1 — chance a call throws a retryable ApiError (network)
}

const SERVER_PREFIX: Record<PushItem['payload']['kind'], string> = {
	cash_payment: 'ACC-PAY-2026-',
	goods_issue: 'MAT-STE-2026-',
	stock_return: 'MAT-STE-2026-',
	stock_damaged: 'MAT-STE-2026-',
	pos_opening: 'POS-OPE-2026-',
	pos_closing: 'POS-CLO-2026-',
};

const REJECT_REASON: Record<PushItem['payload']['kind'], string> = {
	cash_payment: 'Voucher already redeemed on another device.',
	goods_issue: 'Entitlement was revoked on the backend.',
	stock_return: 'Stock line does not match warehouse records.',
	stock_damaged: 'Stock line does not match warehouse records.',
	pos_opening: 'Another opening entry exists for this profile today.',
	pos_closing: 'Opening entry not found on the backend.',
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const fakeNo = () => String(Math.floor(Math.random() * 90000) + 10000);

export class MockAdapter implements ApiAdapter {
	private readonly latencyMs: number;
	private readonly rejectRate: number;
	private readonly failRate: number;

	constructor(opts: MockAdapterOptions = {}) {
		this.latencyMs = opts.latencyMs ?? 350;
		this.rejectRate = opts.rejectRate ?? 0;
		this.failRate = opts.failRate ?? 0;
	}

	private async simulateTransport(): Promise<void> {
		await sleep(this.latencyMs);
		if (Math.random() < this.failRate) {
			throw new ApiError('Mock network failure.', true);
		}
	}

	// Any credentials work in the dummy build (README "Signing in").
	async login(req: LoginRequest): Promise<LoginResponse> {
		await this.simulateTransport();
		if (!req.email.trim() || !req.password.trim()) {
			throw new ApiError('Email and password are required.', false);
		}
		if (!req.email.includes('@')) {
			throw new ApiError('Enter a valid email address.', false);
		}
		return { token: `mock-token-${fakeNo()}`, agent: currentAgent, posProfiles };
	}

	async push(item: PushItem): Promise<PushResult> {
		await this.simulateTransport();
		const { kind } = item.payload;
		if (Math.random() < this.rejectRate) {
			return { outcome: 'rejected', reason: REJECT_REASON[kind] };
		}
		const result: PushResult = {
			outcome: 'accepted',
			serverName: `${SERVER_PREFIX[kind]}${fakeNo()}`,
		};
		// Voucher flows also produce an Entitlement Redemption (docs/NPPOS_WEB.md).
		if ((kind === 'cash_payment' || kind === 'goods_issue') && 'voucherNo' in item.payload && item.payload.voucherNo) {
			result.relatedNames = { entitlementRedemption: `ENT-RED-2026-07-${fakeNo()}` };
		}
		return result;
	}

	async pull(cursors: PullCursors): Promise<PullResponse> {
		await this.simulateTransport();
		const now = new Date().toISOString();
		return {
			projects: [],
			disbursementOrders: [],
			assignments: [],
			beneficiaries: [],
			vouchers: [],
			entitlements: [],
			hampers: [],
			agentStock: [],
			posProfiles: [],
			cursors: {
				projects: now,
				disbursementOrders: now,
				assignments: now,
				beneficiaries: now,
				vouchers: now,
				entitlements: now,
				hampers: now,
				agentStock: now,
				posProfiles: now,
			},
		};
	}
}
