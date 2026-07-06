# NPPOS — Non-Profit POS

Offline-first **React Native (Expo)** point-of-sale app for the **AIGT HDR disbursement system**. Field **agents** distribute goods (hampers), physical cash (via vouchers), and card-based cash to **beneficiaries**, and coordinate with **merchants**. The backend is **Frappe/ERPNext** (already built, out of this repo) — the app talks to it over REST.

> **Current state: UI/navigation prototype on dummy data.**
> This build wires up every screen and the full navigation tree so you can feel the app end-to-end. There is **no SQLite, no Redux, and no sync engine yet** — all data is in-memory mock data served from [`src/data/mock.ts`](src/data/mock.ts). Those layers are designed in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and come next.

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

**Signing in:** it's a dummy build — enter any Agent/Warehouse ID and **any PIN**. Toggle **Agent** vs **Admin** on the login screen to see the role-gated admin section.

> **Heads-up:** after pulling changes that add or move routes/`_layout.tsx` files, Fast Refresh does **not** rebuild expo-router's route tree. Restart Metro with a clean cache:
> ```bash
> npx expo start -c
> ```

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | **Expo SDK 54** (New Architecture, React 19, RN 0.81) |
| Routing | **expo-router v6** (file-based, `src/app/`) |
| Styling | **NativeWind 4** (Tailwind for RN) |
| UI primitives | **react-native-reusables** (cva + `tailwind-merge`) in [`src/components/ui/`](src/components/ui) |
| Icons | `@expo/vector-icons` (Material Icons) |
| Language | TypeScript (strict) |

**Planned (not in this build):** expo-sqlite + Drizzle ORM (source of truth for domain data), Redux Toolkit + redux-persist (session/UI/flow/sync state only), and an outbox-based sync engine against a swappable `ApiAdapter` (`MockAdapter` → `FrappeAdapter`). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Domain glossary

- **Beneficiary** — pre-registered aid recipient assigned to an agent (agents only see their own list).
- **Voucher** — transaction identifier for walk-ins with no pre-record; has a validity window and a **hard limit of 2 uses**. Voucher-no search is exact-match; beneficiary-no search lists that beneficiary's active vouchers.
- **Entitlement** — what a beneficiary/voucher is allocated: a hamper, a cash amount, or card cash.
- **Hamper / BOM** — a finished good (e.g. "Food Basket A") composed of stock items (rice, oil, salt…).
- **Disbursement Order (DO)** — backend document driving per-agent assignments.
- **Project** — mandatory reference on **every** transaction.
- **Agent** — the app's primary user (modeled as an ERPNext warehouse).
- **Merchant** — vendor + warehouse; distributes hampers, compensated per hamper.

## Roles

- **Agent** (primary) — POS dashboard, goods issue, cash via voucher, card withdrawal, own stock, own transactions, end-of-day reconciliation.
- **Admin** — everything agents see, plus oversight: agents' progress, DO summaries, reports. Gated in [`src/app/(app)/admin/`](src/app/(app)/admin).

---

## Screens & navigation

`(app)/_layout.tsx` is a **Stack**; `(tabs)` is one screen of it. POS flow routes (`vouchers/`, `goods/`, `card/`, `reconciliation`, `admin/`) are **sibling stack screens that push full-screen over the tab bar** — an agent mid-transaction can't accidentally switch tabs. The Dashboard is a hub of big action tiles (mirrors `docs/pos_design.jpeg`), so everything is ≤2 taps from launch.

```
src/app/
├── _layout.tsx                     # providers (theme, session, online) + root Stack
├── login.tsx                       # dummy sign-in (any PIN; Agent/Admin toggle)
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
├── app/                # routes only (thin screens, compose from components + mock data)
├── components/
│   ├── ui/             # react-native-reusables primitives (button, text, card, input, badge, avatar, separator)
│   └── domain/         # Screen, SyncStatusPill, EntitlementCard, TransactionRow, badges, widgets
├── data/mock.ts        # all dummy data + selector helpers (the temporary "backend")
├── hooks/              # session (dummy auth/role) + online (connectivity flag) contexts
├── lib/                # cn() utils, theme tokens, formatters
└── types/domain.ts     # shared domain types (stable — future adapters serve these shapes)
```

**Dependency direction (target):** `app → components/hooks → repositories → db`, with the sync engine driving `repositories + services/api`. Screens never import Drizzle or an API adapter directly. Today the repositories/db/sync layers are stubbed by `src/data/mock.ts`; the type shapes in `src/types/domain.ts` are kept stable so nothing above the data layer changes when the real DB and adapters land.

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
- **Agent/contributor rules:** [`AGENTS.md`](AGENTS.md)
- **POS flow diagram:** `docs/pos_design.jpeg`
- **Expo SDK 54 docs:** https://docs.expo.dev/versions/v54.0.0/
- **react-native-reusables:** https://reactnativereusables.com/docs/components
- **AIGT disbursement guide:** https://aigt-staging.navari.co.ke/user-guide/disbursement/overview

## Roadmap

- [x] Navigation tree + all screens on dummy data
- [ ] expo-sqlite + Drizzle schema, migrations, seed
- [ ] Repositories + `useLiveQuery` reactive reads
- [ ] Redux Toolkit (session/UI/POS-flow/sync status) + redux-persist
- [ ] Outbox sync engine + `MockAdapter`
- [ ] `FrappeAdapter` against ERPNext REST
- [ ] Dev-client build (QR voucher scanning, receipt printing, SQLCipher)
</content>
</invoke>
