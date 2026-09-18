# The nppos Frappe app (web POS) — Entitlement Voucher & Redemption

Second backend app in the workspace: **nppos** (`frappe-bench/apps/nppos`,
module `NPPOS`, requires erpnext). It is the **web POS** counterpart of this
mobile app — same idea (distribute entitlements at a point of sale), built as a
Frappe app with a React SPA served at `/np-pos`. This is where **Entitlement
Voucher** and **Entitlement Redemption** actually live (they are *not* in
aigt_hdr — see `docs/FRAPPE_BACKEND.md`).

## Entitlement Voucher

Submittable. **The doc name IS the voucher number** (`autoname:
field:voucher_number`) — so `voucher_number` is unique server-side, matching
our local unique `voucher_no`.

| Field | Type | Notes |
|---|---|---|
| `voucher_number` | Data, reqd | doubles as the doc name |
| `status` | Select | **Draft / Active / Partially Redeemed / Redeemed / Expired / Cancelled** |
| `entitlement_type` | Select, reqd | **Goods / Cash** — one type per voucher |
| `valid_from` | Date, reqd | `valid_to` is optional |
| `item`, `qty`, `uom`, `rate` | | the goods side (single item, no child table) |
| `amount`, `currency` | | the cash side |
| `party_type` + `party` | Dynamic Link | who it belongs to (e.g. Customer/Supplier/Beneficiary) |
| `agent` | Link Employee | issuing agent |
| `merchant` | Link Supplier | for merchant-distributed vouchers |
| `warehouse` | Link | where goods redemption draws stock from |
| `company` (reqd), `project`, `cost_center`, `description` | | accounting dimensions apply |

**Local model matches this:** a voucher carries **one** entitlement (Goods *or*
Cash). Locally, `vouchers.entitlement_type` mirrors the backend field and
exactly **one** `entitlements` row exists per voucher holding the detail
(hamperId/qty or amount) — one Entitlement Voucher ⇄ one voucher row + one
entitlement row at sync time. Voucher status is derived from what's left to
redeem: all entitlements issued → `redeemed`, else `partially_redeemed`.
The backend still has **no max-uses / transaction-count field**, but the rule is
now enforced on both sides: `EntitlementRedemption.update_voucher_status_on_submit`
counts submitted redemptions and throws past `MAX_USES = 2` (which `sync_push`
turns into a `rejected` → the device parks the row for admin review), and marks
the voucher Redeemed once the uses are spent even with value left on it. The
device applies the same rule locally before queueing (AGENTS.md rule 4).

`warehouse` is what scopes a voucher to a POS profile. The device holds the
vouchers of **every** profile the agent can work under (the pull covers the union
of their warehouses), so `vouchers.warehouse` is what every profile-scoped list
filters on, and redeeming a voucher whose warehouse isn't the open shift's is
refused locally.

## Entitlement Redemption

Submittable, named `ENT-RED-.YYYY.-.MM.-`. One redemption doc per voucher use.
Carries the same descriptive fields as the voucher (type, item/qty/uom/rate,
amount/currency, party, agent, merchant, warehouse, project, cost_center)
plus: `entitlement_voucher` (reqd link), `posting_date`, **`pos_profile`**,
payment routing (`paid_from`, `paid_to`, company + party bank accounts), and a
sales-team/commission block (Sales Invoice scaffolding, ignorable for us).

**Controller behavior (`on_submit`)** — this is the important part:

- `entitlement_type == "Cash"` → creates **and submits** a Payment Entry
  (type Pay, party from the redemption, `reference_no` = redemption name).
  Mode of payment comes from the linked **POS Profile's default payment
  method**. Requires party, amount, company, paid_from, paid_to.
- `entitlement_type == "Goods"` → creates **and submits** a Stock Entry
  (Material Issue) drawing `item`/`qty` from `warehouse`
  (`allow_zero_valuation_rate: 1`). Requires item, qty, warehouse, company.

So unlike aigt_hdr's cash pipeline (draft Payment Entries reconciled later by
Collection Reconciliation), **the nppos redemption posts to the ledger/stock
immediately on submit**. For the mobile app that means a synced
`voucher_redemption` = one Entitlement Redemption insert+submit, and the
Payment/Stock Entry comes out the other side automatically — we do *not* also
push a separate Payment/Stock Entry for voucher flows.

## Custom fields the app installs

- **Payment Entry** and **Stock Entry**: `entitlement_redemption` +
  `entitlement_voucher` links (the audit trail back from ERPNext docs).
- **POS Profile**: `enable_entitlement_distribution` checkbox — this is the
  flag that marks a POS Profile as an entitlement-distribution profile. Our
  local `pos_profiles` rows should only ever be profiles with this enabled.

## State of the web SPA (`np-pos/`)

React (vite + shadcn/base-ui) scaffold only as of this writing: auth pages,
empty dashboard, users page, theme customizer. **No voucher search, redemption,
or POS opening/closing screens exist yet** — the doctypes are ahead of the UI.
Mobile is currently the furthest-along POS client.

## The delta pull (`nppos.sync_api.sync_pull`)

Built by `nppos/sync_pull.py`, scoped to the **union of the warehouses** on the
agent's distribution-enabled POS profiles — never by user/employee.

- **vouchers** are delta-filtered on `modified`, plus any voucher touched by a
  redemption since the cursor (a redemption does not bump the voucher's own
  `modified`). Each row carries `warehouse` so the device can scope it to one
  profile, and a derived `status` that folds in expiry and the 2-use rule.
- **agent_stock** and **hampers** are **full snapshots on every pull**, never
  derived from the voucher delta. This is load-bearing: adding stock in the desk
  touches only the `Bin`, so an item list derived from changed vouchers starves
  the collection the moment no voucher has changed — the device would never see
  new stock. Bins holding nothing are skipped unless a voucher in the pull names
  that item (an agent needs to see they have run out).
- Every stock row's item is also sent as a hamper: the device's
  `agent_stock.hamper_id` is a FK to `hampers`, and a missing parent rolls back
  the entire pull transaction.
- **pos_settings** is the app's configuration (AIGT HDR Settings › POS App, read
  by `nppos/sync_settings.py`) and is sent **in full on every pull**, including
  the empty payload a user with no distribution profile gets. Keys, all ints
  (Checks are 0/1): `max_offline_hours` (72, 0 = never block),
  `transaction_retention` (500, 0 = keep all), `show_redeemed_vouchers` (1),
  `max_uses_cash` (2), `max_uses_goods` (1), `show_hamper_contents` (1),
  `show_beneficiary_details` (1), `require_close_out_photo` (0). A site without
  aigt_hdr installed gets those same defaults. `max_uses` on each voucher is
  stamped from the matching one of these, and `status` folds the same limit in.
- `issued_today` / `damaged` are always `0` — the backend has no per-day
  counters. They are device-side tallies, so `applyPull` sets them on insert
  only and never updates them, and pulled `on_hand` is reduced by whatever is
  still queued in the outbox to leave that warehouse.

## Known gaps to raise with the backend team

1. No validation that the voucher is within its validity window at redemption
   (the device checks `valid_from`/`valid_to` locally; the backend does not).
   Nothing flips a voucher to `Expired` on its `valid_to` either — the pull
   derives that status rather than reading it.
2. No whitelisted search/redeem API beyond the sync methods — screens that want
   live lookups would use plain REST on the doctypes. **The whitelisted sync
   methods (`nppos.sync_api.login` / `sync_push` / `sync_pull`) live in the nppos
   app, not aigt_hdr** — the mobile `FrappeAdapter` (`src/services/api/frappe/`)
   is already wired to that namespace.

Closed since this doc was first written: redemption `on_submit` now maintains
the voucher status (and reverses it on cancel), the use limit is enforced
server-side (and is now configuration — `max_uses_for` in `sync_settings.py`,
read at submit), and redemptions carry `pos_opening_entry` so a POS Closing
Entry can autofill its linked redemptions.

## Mapping to the mobile app's local DB

| Local | nppos backend |
|---|---|
| `vouchers` row | Entitlement Voucher (name = voucher no) |
| `entitlements` row with `voucherId` | the voucher's own type/item/amount (1:1) |
| `voucher_redemptions` row | Entitlement Redemption (submit → auto PE/SE) |
| `vouchers.status` | same vocabulary: `active`, `partially_redeemed`, `redeemed`, `expired` (Draft/Cancelled never reach the device) |
| `pos_profiles` | POS Profile with `enable_entitlement_distribution` = 1 |
| `pos_sessions` | POS Opening/Closing Entry (mobile-side convention; backend wiring pending — gap #4) |

## Session close & logout policy (mobile-side decisions)

- **Closing a POS session** (reconciliation screen) immediately attempts a
  sync/reconcile if the device is online; offline, the closing entry waits in
  the outbox like everything else.
- **Signing out** with an open session auto-closes it (counted cash defaults
  to expected, payload flagged `autoClosed`) and reconciles/syncs if online —
  an agent never leaves a session dangling. The proper count still happens on
  the reconciliation screen; auto-close is the fallback path.
- **The close-out photo can be made mandatory** (`require_close_out_photo`).
  When it is, `closePosSession()` refuses without one and sign-out with an open
  session is refused outright — its auto-close path has no photo to attach. The
  backend deliberately does NOT reject a photo-less `pos_closing` push: a
  rejection would leave a locally closed shift with no closing entry on the
  server, which is worse than a missing attachment.
