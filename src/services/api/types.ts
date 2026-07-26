// The ApiAdapter contract (docs/ARCHITECTURE.md §1, §4). Everything above this
// layer — repositories, the future sync engine, screens — depends only on these
// types. MockAdapter serves them from dummy data now; FrappeAdapter will serve
// the same shapes from ERPNext REST later (docs/FRAPPE_BACKEND.md has the
// doctype mapping). Screens/hooks never import an adapter directly (AGENTS.md
// rule 6) — they go through getApi() in ./index.ts.

import type {
	Agent,
	AgentStockRow,
	Assignment,
	Hamper,
	PosProfile,
	Voucher,
} from '@/types/domain';
// (PosProfile appears in both LoginResponse and PullResponse — login seeds the
// picker on a fresh install; pull keeps the set updated afterwards.)

// ---- auth -------------------------------------------------------------------

// System-level login (backend: Frappe user). Which POS profile to work under
// is chosen AFTER login from the locally pulled `pos_profiles` — the adapter
// doesn't care; the active profile is app session state.
export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	token: string;
	agent: Agent;
	// The user's distribution-enabled POS profiles — upserted into SQLite right
	// after login so the profile picker works on a fresh install, before any
	// sync_pull has run.
	posProfiles: PosProfile[];
}

// ---- push (outbox flush) ----------------------------------------------------

// Exactly the JSON written to `outbox.payload` by src/repositories/mutations.ts.
// One payload = one business transaction (composite; internal refs are client
// UUIDs — the FrappeAdapter rewrites them to server names at push time,
// ARCHITECTURE.md §4 "Dependent records").
export type OutboxPayload =
	| {
			kind: 'cash_payment';
			voucherNo: string; // → Entitlement Redemption (Cash) on the voucher
			amount: number;
			posSession: string;
	  }
	| {
			kind: 'goods_issue';
			voucherNo: string; // → Entitlement Redemption (Goods) on the voucher
			hamper: string;
			qty: number;
			warehouse: string; // Stock Entry source (the session profile's warehouse)
			posSession: string;
	  }
	| {
			kind: 'stock_return' | 'stock_damaged';
			warehouse: string;
			hamper: string;
			qty: number;
	  }
	| { kind: 'pos_opening'; posProfile: string; openingFloat: number }
	| {
			kind: 'pos_closing';
			session: string;
			openingFloat: number;
			paidOut: number;
			expectedCash: number;
			countedCash: number;
			difference: number;
			autoClosed: boolean;
	  };

export interface PushItem {
	// Client UUID — doubles as the idempotency key (`custom_client_ref`).
	// Re-pushing the same id must be a no-op server-side.
	id: string;
	payload: OutboxPayload;
	createdAt: string;
	attempt: number;
}

// A push either lands, or the server *validly refuses* it (→ local status
// 'conflict', admin resolves online — never retried, never deleted).
// Transport/server failures are NOT results: adapters throw ApiError and the
// sync engine backs off and retries.
export type PushResult =
	| {
			outcome: 'accepted';
			// Primary ERPNext doc name (Payment Entry / Stock Entry / POS
			// Opening/Closing Entry…). UI shows it once status is 'synced'.
			serverName: string;
			// Secondary docs created by the same submit, keyed by role —
			// e.g. { entitlementRedemption: 'ENT-RED-2026-06-0001' }.
			relatedNames?: Record<string, string>;
	  }
	| {
			outcome: 'rejected';
			// Human-readable validation failure (double-spent voucher, revoked
			// entitlement…). Shown on the conflict row in "Needs review".
			reason: string;
	  };

export class ApiError extends Error {
	constructor(
		message: string,
		// true → network/5xx, safe to retry with backoff.
		// false → auth/protocol problem needing intervention, don't hammer.
		readonly retryable: boolean,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

// ---- pull (reference-data delta) -------------------------------------------

// Per-collection cursors from the local `sync_meta` table; adapters return
// rows modified since each cursor. undefined cursor = first pull (full set).
export type PullCursors = Partial<Record<PullCollection, string>>;

export type PullCollection =
	| 'assignments'
	| 'vouchers'
	| 'hampers'
	| 'agentStock'
	| 'posProfiles';

export interface PullResponse {
	assignments: Assignment[];
	vouchers: Voucher[]; // entitlement folded inline (Cash|Goods)
	hampers: Hamper[]; // items inline, like the domain type
	agentStock: AgentStockRow[];
	posProfiles: PosProfile[];
	// New cursor per collection, persisted to sync_meta after upsert.
	cursors: Record<PullCollection, string>;
}

// ---- the adapter ------------------------------------------------------------

export interface ApiAdapter {
	login(req: LoginRequest): Promise<LoginResponse>;
	// Flush one outbox item. The sync engine calls this FIFO per queue.
	push(item: PushItem): Promise<PushResult>;
	// Delta-pull the agent's reference data (assignments, beneficiaries,
	// vouchers, entitlements, stock…). Local pending transactions win until
	// resolved (ARCHITECTURE.md §4).
	pull(cursors: PullCursors): Promise<PullResponse>;
	// Adapters that authenticate per request (FrappeAdapter) receive the
	// session token here — after login and again on app relaunch (persisted
	// auth). null on sign-out. MockAdapter ignores it.
	setToken?(token: string | null): void;
}
