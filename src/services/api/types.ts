// The ApiAdapter contract (docs/ARCHITECTURE.md §1, §4). Everything above this
// layer — repositories, the future sync engine, screens — depends only on these
// types. MockAdapter serves them from dummy data now; FrappeAdapter will serve
// the same shapes from ERPNext REST later (docs/FRAPPE_BACKEND.md has the
// doctype mapping). Screens/hooks never import an adapter directly (AGENTS.md
// rule 6) — they go through getApi() in ./index.ts.

import type { PosSettings } from '@/lib/pos-settings';
import type {
	Agent,
	AgentStockRow,
	Assignment,
	Beneficiary,
	Bom,
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
			kind: 'stock_return';
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
			photo?: ClosingPhoto;
	  };

export interface ClosingPhoto {
	name: string;
	mime: string;
	data: string; // base64
}

export interface PushItem {
	// Client UUID — doubles as the idempotency key (`custom_client_ref`).
	// Re-pushing the same id must be a no-op server-side.
	id: string;
	payload: OutboxPayload;
	createdAt: string;
	attempt: number;
}

// Every push is recorded in the desk's POS Sync Ledger before it is attempted.
// It either lands, or it is parked there for an admin (→ local 'conflict',
// "needs review" — never retried by the device, never deleted), or an admin
// already rejected it (→ local 'rejected', final). The admin's later decision
// arrives on the pull (PullResponse.transactions).
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
			outcome: 'needs_review';
			// Why it could not post (double-spent voucher, expired voucher, stock
			// short…). Shown on the row in "Needs review".
			reason: string;
			ledger?: string; // POS Sync Ledger row name
	  }
	| {
			outcome: 'rejected';
			// The admin's reason — final, nothing was posted.
			reason: string;
			ledger?: string;
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
	| 'boms'
	| 'hampers'
	| 'agentStock'
	| 'posProfiles'
	| 'beneficiaries'
	| 'transactions'
	// Not a timestamp: the comma-joined warehouse set the last pull covered.
	| 'warehouses';

// One POS Sync Ledger row for this user — the server's verdict on a
// transaction the device pushed (or recorded on another device / before a wipe).
export interface LedgerTransaction {
	clientRef: string; // == pos_transactions.id
	kind: 'cash_payment' | 'goods_issue' | 'stock_return' | 'stock_damaged';
	status: 'pending' | 'synced' | 'needs_review' | 'rejected';
	reason?: string;
	resolution?: string;
	resolutionNote?: string;
	resolvedBy?: string;
	resolvedAt?: string;
	serverName?: string;
	voucherNo?: string;
	hamper?: string;
	warehouse?: string;
	project?: string;
	amount?: number;
	qty?: number;
	createdAt?: string;
	posOpeningEntry?: string;
}

export interface PullResponse {
	assignments: Assignment[];
	vouchers: Voucher[]; // entitlement folded inline (Cash|Goods)
	boms: Bom[]; // hamper contents, components inline
	hampers: Hamper[]; // items inline, like the domain type
	agentStock: AgentStockRow[];
	posProfiles: PosProfile[];
	beneficiaries: Beneficiary[]; // only the parties on the agent's vouchers
	// This user's ledger rows changed since the cursor — how an admin's Retry /
	// Force post / Reject reaches the device. Also rebuilds history after a wipe.
	transactions: LedgerTransaction[];
	settings: PosSettings;
	// New cursor per collection, persisted to sync_meta after upsert.
	cursors: Partial<Record<PullCollection, string>>;
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
