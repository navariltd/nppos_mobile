# NPPOS — Non-Profit POS Mobile App

Offline-first React Native (Expo) POS app for the **HDR disbursement system**. Field **agents** distribute goods (hampers), physical cash (via vouchers), and card-based cash to **beneficiaries**, and coordinate with **merchants**. The backend is **Frappe/ERPNext (already built, not in this repo)** — this app only talks to it over its REST API. **For now all data is dummy data** served through a swappable API adapter (see `src/services/api/`).

Full architecture, diagrams, data model, and screen map: **`docs/ARCHITECTURE.md`** (read it before structural changes).

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Tech stack (decided — do not swap without discussion)

- **Expo SDK 54** (New Architecture, React 19, RN 0.81), **expo-router v6** file-based routing, `src/app/` directory.
- **NativeWind 4** + [react-native-reusables-style](https://reactnativereusables.com/docs) UI primitives in `src/components/ui/` (cva + tailwind-merge; see `components.json`).
- **react-native-keyboard-controller** for keyboard handling (`KeyboardProvider` in the root layout). Android is edge-to-edge, so RN's `KeyboardAvoidingView` / `automaticallyAdjustKeyboardInsets` don't keep inputs visible — screens with text fields scroll via `Screen` (or `KeyboardAwareScrollView` directly), never a plain `ScrollView`.
- **expo-sqlite + Drizzle ORM** — local DB is the **source of truth for all domain data** (beneficiaries, vouchers, entitlements, stock, transactions). Use `drizzle-orm/expo-sqlite` `useLiveQuery` for reactive reads (requires `enableChangeListener: true`).
- **Redux Toolkit** (+ redux-persist) — **only** for session/auth, UI state, active POS flow state, and sync-engine status. Never mirror SQLite tables into Redux.
- **Sync**: outbox pattern. Every local mutation = one SQLite transaction writing the domain row(s) **and** an `outbox` row with a client-generated UUID (idempotency key). A sync engine flushes the outbox when online and pulls assignments/reference data. See ARCHITECTURE.md §Sync.

## Domain glossary (from the spec — use these exact terms)

- **Beneficiary** — aid recipient, pre-registered and assigned to an agent (agents only ever see their own assigned list).
- **Voucher** — transaction identifier for walk-in beneficiaries with no pre-record. Has validity period, project/disbursement-order link, and a **configurable limit on how many transactions it allows** (AIGT HDR Settings › POS App — cash defaults to 2, goods to 1). Exact-match search by voucher no; searching by beneficiary no lists all their active vouchers.
- **Entitlement** — what a beneficiary/voucher is allocated (a hamper, a cash amount, or both).
- **Hamper / BOM** — finished good (e.g. "Project 1-Jun-2026-Food Basket A") composed of stock items (rice, oil, salt…).
- **Disbursement Order (DO)** — backend document driving everything; agents receive per-agent assignments from it.
- **Project** — mandatory reference on **every** transaction.
- **Agent** — app's primary user; modeled as a **warehouse** in ERPNext (goods issues deduct from the agent's warehouse).
- **Merchant** — modeled as vendor + warehouse; distributes hampers, compensated per hamper issued.
- Distribution results map to ERPNext docs on sync: goods → **Stock Entry (type Issue)**; cash → **Payment Entry (type Pay)**; card → real-time bank API (**online-only flow**).

## Roles

- **Agent** (primary): POS dashboard, goods issue, cash via voucher, card withdrawal, own stock, own transactions, end-of-day close-out.
- **Admin**: everything agents see plus oversight — agents' progress, DO summaries, reports. Role gates routes in `src/app/(app)/admin/`.

## Hard rules

1. Domain data lives in SQLite; Redux holds no domain rows.
2. All writes are offline-capable **except** the card/bank flow and the **shift boundaries** — opening a POS session, closing one, and signing out all require connectivity and a clean outbox (`src/features/sync/preflight.ts`: flush + pull, then refuse if anything is still queued). Distribution itself — redemptions, stock moves — stays fully offline. Disable those actions in the UI when offline.
3. Every mutation gets a client UUID before it leaves the device; sync must be idempotent and retry-safe.
4. The voucher's use limit and validity are validated locally at issue time **and** re-validated server-side at sync; conflicts land in a review state, never silently dropped. The limit is configuration, not a constant — one number for cash and one for goods on AIGT HDR Settings › POS App, read at redemption time on both sides (`maxUsesFor` in `src/lib/pos-settings.ts`, `max_uses_for` in `nppos/sync_settings.py`). Conflict resolution is an **admin** action and happens **online**.
5. All transactions carry project + disbursement-order references.
6. The API layer is an interface (`ApiAdapter`): `MockAdapter` (dummy data, default now) and later `FrappeAdapter`. Screens/hooks never import an adapter directly.
7. **Out of scope — do not reintroduce:**
   - **Cash balances.** The POS verifies and distributes what the system holds; it never tallies a collection point's drawer. No opening float, counted cash, expected cash, or difference is asked of or shown to an agent. ERPNext's POS Opening/Closing Entries still get a balance row, always **zero**, purely so the documents submit (`OPENING_FLOAT` in `src/repositories/mutations.ts`). Balances invite "it doesn't tally" reporting the project does not own.
   - **Damaged / lost goods.** Handled by AIGT's procurement process — the collection point reports it and procurement covers replacement and related costs (transport etc.). Writing it off here would both duplicate that process and misstate it, since usually a single component of a hamper is damaged, not the whole hamper. Stock returns to the central warehouse are the only adjustment the POS makes.
8. **App configuration comes from the backend.** The POS App tab of AIGT HDR Settings is pulled in full on every sync into the local `app_settings` table; read it with `useSettings()` (screens) or `getSettings()` (mutations) from `src/repositories/settings.ts`. Never hard-code a value that has a setting, and never add a device-side screen for these — an agent does not configure their own limits.

## Commands

- `npm start` / `npm run android` / `npm run ios` — Expo dev server.
- No test runner configured yet.

## Reference docs

- POS flow diagram: `docs/pos_design.jpeg`
- Frappe backend (aigt_hdr) doctypes & flows, distilled for this app: `docs/FRAPPE_BACKEND.md` — read this instead of digging through the backend source.
- The nppos web-POS app (Entitlement Voucher / Entitlement Redemption doctypes, redemption→ledger behavior): `docs/NPPOS_WEB.md`.
