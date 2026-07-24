# NPPOS — Non-Profit POS

Offline-first **React Native (Expo)** point-of-sale app for the **HDR disbursement system**. Field **agents** distribute goods (hampers), physical cash (via vouchers), and card-based cash to **beneficiaries**, and coordinate with **merchants**. The backend is **Frappe/ERPNext** (already built, out of this repo) — the app talks to it over REST.

> **Current state: full offline data layer + real outbox sync engine, running on the MockAdapter.**
> Every screen reads reactively from **expo-sqlite via Drizzle** (`useLiveQuery`), and every POS action(cash payout, hamper issue, card withdrawal, stock return/damage, voucher redemption, POS session open/close) is a real local DB transaction paired with an outbox row. [`src/data/mock.ts`](src/data/mock.ts) now only feeds the one-time seed. The **`ApiAdapter` interface + `MockAdapter`** live in [`src/services/api/`](src/services/api) (login already routes through it), and **Redux Toolkit + redux-persist** hold session/auth and sync status ([`src/store/`](src/store), [`src/features/`](src/features)). **No sync engine yet** - the outbox queues everything and a dev-only "Sync now" stub simulates a flush. The sync engine (driving the adapter) + the `FrappeAdapter` come next; the backend mapping is already documented in [`docs/FRAPPE_BACKEND.md`](docs/FRAPPE_BACKEND.md) and [`docs/NPPOS_WEB.md`](docs/NPPOS_WEB.md).

---

## Quick start

```bash
npm install
npm start          # Expo dev server (press i / a, or scan the QR in Expo Go)
```

Other scripts:

```bash
npm run ios        # open in iOS simulator
npm run android    # open in Android emulator/device
npm run web        # run in the browser
```

**Signing in:** it's a dummy build — enter any email and **any password**, then **pick a POS profile** (the profile's warehouse decides which stock you see; switch later from Profile → "POS profile", after closing any open session). Toggle **Agent** vs **Admin** on the login screen to see the role-gated admin section. Signing out logs out of the whole system — the next login picks a profile again.

**Seeding:** on first launch the app runs migrations and seeds SQLite from `src/data/mock.ts` (once, only when the DB is empty). Delete the app from the device/simulator to reseed from scratch. To actually issue anything you must first **open a POS session** from the dashboard (enter an opening cash float) — closing it happens on the Reconciliation screen.

> **Heads-up:** after pulling changes that add or move routes/`_layout.tsx` files, Fast Refresh does **not** rebuild expo-router's route tree. Restart Metro with a clean cache:
>
> ```bash
> npx expo start -c
> ```

---

## Tech stack

| Area          | Choice                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Framework     | **Expo SDK 54** (New Architecture, React 19, RN 0.81)                                            |
| Routing       | **expo-router v6** (file-based, `src/app/`)                                                      |
| Database      | **expo-sqlite + Drizzle ORM** — local source of truth, reactive reads via `useLiveQuery`         |
| Styling       | **NativeWind 4** (Tailwind for RN)                                                               |
| UI primitives | **react-native-reusables** (cva + `tailwind-merge`) in [`src/components/ui/`](src/components/ui) |
| Icons         | `@expo/vector-icons` (Material Icons)                                                            |
| Language      | TypeScript (strict)                                                                              |

| App state      | **Redux Toolkit + redux-persist** — session/auth (persisted) and sync status only; no domain rows |
| API layer      | **`ApiAdapter` interface** ([`src/services/api/`](src/services/api)) — `MockAdapter` now, `FrappeAdapter` later |

**Sync is real now:** `features/sync/engine.ts` flushes the outbox FIFO through the adapter (accepted → synced + server doc name · rejected → `conflict` for admin review · failure → backoff, order preserved), then delta-pulls reference data. Triggers: coming online, app foreground, 60s interval, manual "Sync now", session close. The **`FrappeAdapter`** is written against the three whitelisted endpoints specced in [`docs/SYNC_API.md`](docs/SYNC_API.md) — set `EXPO_PUBLIC_FRAPPE_URL` to use it; the **Python side of those endpoints is the next step**.

---

## Browsing the on-device database (Drizzle Studio)

The dev build ships with [`expo-drizzle-studio-plugin`](https://www.npmjs.com/package/expo-drizzle-studio-plugin), which bridges the **live SQLite database on the connected phone/simulator** to Drizzle Studio in your browser — real tables, real rows, updating as you use the app.

1. Start the dev server (`npm start`) and open the app on the device — the bridge lives inside the running app.
2. In the terminal running Expo, press **`shift + m`** (more tools).
3. Select **`expo-drizzle-studio-plugin`** — Studio opens in a browser tab against the device's DB.

Issue an entitlement in the app and watch the row land in `pos_transactions` (plus its `outbox` twin); open/close a session and check `pos_sessions` and `voucher_redemptions`.

> Note: `npx drizzle-kit studio` does **not** work here — the DB file lives inside the app sandbox on the device, unreachable from your machine. Always go through `shift + m`.

<!-- TODO(@emiliocliff): add screenshot -->
<!-- ![Drizzle Studio browsing the on-device NPPOS database](docs/drizzle-studio.png) -->


---

## Domain glossary

- **Beneficiary** — pre-registered aid recipient assigned to an agent (agents only see their own list).
- **Voucher** — transaction identifier for walk-ins with no pre-record; carries **one entitlement** (cash amount *or* a hamper, mirroring the backend's Entitlement Voucher), a validity window, and a **hard limit of 2 uses** (local rule). Voucher-no search is exact-match; beneficiary-no search lists that beneficiary's vouchers.
- **Entitlement** — what a beneficiary/voucher is allocated: a hamper, a cash amount, or card cash.
- **Hamper / BOM** — a finished good (e.g. "Food Basket A") composed of stock items (rice, oil, salt…).
- **Disbursement Order (DO)** — backend document driving per-agent assignments.
- **Project** — mandatory reference on **every** transaction.
- **Agent** — the app's primary user (modeled as an ERPNext warehouse).
- **Merchant** — vendor + warehouse; distributes hampers, compensated per hamper.

## Roles

- **Agent** (primary) — POS dashboard, goods issue, cash via voucher, card withdrawal, own stock, own transactions, end-of-day reconciliation.
- **Admin** — everything agents see, plus oversight: agents' progress, DO summaries, reports. Gated in [`src/app/(app)/admin/`](<src/app/(app)/admin>).

---

## Screens & navigation

`(app)/_layout.tsx` is a **Stack**; `(tabs)` is one screen of it. POS flow routes (`vouchers/`, `goods/`, `card/`, `reconciliation`, `admin/`) are **sibling stack screens that push full-screen over the tab bar** — an agent mid-transaction can't accidentally switch tabs. The Dashboard is a hub of big action tiles (mirrors `docs/pos_design.jpeg`), so everything is ≤2 taps from launch.

```
src/app/
├── _layout.tsx                     # providers (store, theme) + root Stack
├── login.tsx                       # step 1: email + password (any password; Agent/Admin toggle)
├── select-profile.tsx              # step 2: choose the POS profile to work under
├── +not-found.tsx
└── (app)/                          # auth-gated group
    ├── _layout.tsx                 # Stack: (tabs) + flow routes
    ├── (tabs)/                     # Dashboard · Beneficiaries · Transactions · Stock · Profile
    │   ├── index.tsx               # POS dashboard (action-tile hub)
    │   ├── beneficiaries.tsx
    │   ├── transactions.tsx        # history · pending · conflicts
    │   ├── stock.tsx
    │   └── profile.tsx
    ├── vouchers/
    │   ├── index.tsx               # search (voucher no exact · ben no → active vouchers)
    │   └── [voucherNo].tsx         # detail + issue entitlement
    ├── goods/
    │   ├── index.tsx               # beneficiary/voucher picker
    │   └── issue/[entitlementId].tsx   # confirm issue (modal)
    ├── card/
    │   ├── index.tsx               # validate card (online-only gate)
    │   └── withdraw.tsx            # withdrawal (modal)
    ├── beneficiaries/[id].tsx      # detail + history
    ├── reconciliation.tsx          # end-of-day summary
    └── admin/                      # role-guarded
        ├── _layout.tsx
        ├── index.tsx               # oversight dashboard
        ├── agents.tsx              # progress per agent
        └── orders.tsx              # DO summaries
```

---

## Project layout

```
src/
├── app/                # routes only (thin screens, compose from components + repositories)
├── components/
│   ├── ui/             # react-native-reusables primitives (button, text, card, input, badge, avatar, separator)
│   └── domain/         # Screen, SyncStatusPill, PosSessionCard, EntitlementCard, TransactionRow, badges, widgets
├── db/                 # Drizzle schema, client (openDatabaseSync + change listener), migrations, seed, DbProvider
├── repositories/       # the ONLY module touching db/ — useLiveQuery read hooks + transactional mutations
├── services/api/       # ApiAdapter interface + MockAdapter (FrappeAdapter later) — resolved via getApi()
├── features/           # Redux slices: auth (session, sign-in thunk) + sync (engine status)
├── store/              # RTK store, redux-persist (auth only), typed hooks, StoreProvider
├── data/mock.ts        # dummy fixtures — consumed by the seed (and currentAgent/agentsOverview for now)
├── hooks/              # useSession/useOnline (thin wrappers over the store) + theme
│                       # connectivity = real NetInfo state + "Simulate offline" dev switch (Profile)
├── lib/                # cn() utils, theme tokens, formatters, uuid
└── types/domain.ts     # shared domain types (stable — future adapters serve these shapes)
```

**Dependency direction:** `app → components/hooks → repositories → db`, with the future sync engine driving `repositories + services/api`. Screens never import Drizzle or an API adapter directly — reads go through the hooks in `src/repositories/queries.ts`, writes through `src/repositories/mutations.ts` (each mutation = one SQLite transaction writing domain rows **plus an outbox row** keyed by a client UUID).

---

## Hard rules (enforced as the real layers land)

1. Domain data lives in SQLite; Redux holds no domain rows.
2. All writes are offline-capable **except** the card/bank flow, which requires connectivity (disabled in the UI when offline).
3. Every mutation gets a client UUID before it leaves the device; sync is idempotent and retry-safe.
4. Voucher limit (2 uses) and validity are validated locally **and** re-validated server-side at sync; conflicts land in a review state, never silently dropped.
5. Every transaction carries project + disbursement-order references.
6. The API layer is an interface (`ApiAdapter`): `MockAdapter` now, `FrappeAdapter` later — screens/hooks never import an adapter directly.

---

## Docs & references

- **Architecture (read before structural changes):** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Frappe backend (aigt_hdr) distilled — doctypes, cash/goods pipelines:** [`docs/FRAPPE_BACKEND.md`](docs/FRAPPE_BACKEND.md)
- **nppos web-POS app — Entitlement Voucher/Redemption, POS Profile wiring:** [`docs/NPPOS_WEB.md`](docs/NPPOS_WEB.md)
- **Sync API contract (the spec for the backend Python endpoints):** [`docs/SYNC_API.md`](docs/SYNC_API.md)
- **Agent/contributor rules:** [`AGENTS.md`](AGENTS.md)
- **POS flow diagram:** `docs/pos_design.jpeg`
- **Expo SDK 54 docs:** https://docs.expo.dev/versions/v54.0.0/
- **react-native-reusables:** https://reactnativereusables.com/docs

## Roadmap

- [x] Navigation tree + all screens on dummy data
- [x] expo-sqlite + Drizzle schema, migrations, seed
- [x] Repositories + `useLiveQuery` reactive reads + transactional mutations (outbox on every write)
- [x] POS sessions (open/close ⇄ POS Opening/Closing Entry) + voucher redemptions
- [x] `ApiAdapter` interface + `MockAdapter` (login routed through it)
- [x] Redux Toolkit + redux-persist (auth + sync-status slices; `useSession`/`useOnline` backed by the store)
- [x] Outbox sync engine (FIFO flush, retry/backoff, conflict flagging — admin resolves conflicts, online-only)
- [x] `FrappeAdapter` (client side, against the [`docs/SYNC_API.md`](docs/SYNC_API.md) contract; env-switched via `EXPO_PUBLIC_FRAPPE_URL`)
- [ ] `nppos.api` whitelisted methods in the Frappe app (Python — login / sync_push / sync_pull per the contract)
- [ ] More mock data / edge-case fixtures
- [ ] Dev-client build (QR voucher scanning, receipt printing, SQLCipher)
