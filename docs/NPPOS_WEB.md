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

**Design difference vs our local model:** a backend voucher carries **one**
entitlement (Goods *or* Cash, one item line). Our local `vouchers` +
`entitlements` split is a superset — at sync time one Entitlement Voucher maps
to one local voucher row **plus one** entitlement row. Also note there is **no
max-uses / transaction-count field**: the spec's "2 transactions per voucher"
rule exists only in our local validation for now, and "Partially Redeemed"
implies partial qty/amount redemption rather than counted uses. Flag this to
the backend team.

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

## Known gaps to raise with the backend team

1. Redemption `on_submit` does **not** update the voucher's status — nothing
   flips it to Partially Redeemed/Redeemed. Status management is unfinished.
2. No transaction-count limit on the voucher (the "2 uses" rule is spec-only).
3. No validation that the voucher is Active / within validity at redemption.
4. `pos_profile` on the redemption is informational — no POS Opening/Closing
   Entry integration yet. The mobile app already models sessions as ERPNext
   POS Opening/Closing Entries (see FRAPPE_BACKEND.md); the backend needs the
   same wiring (or a whitelisted method that accepts our session payloads).
5. No whitelisted search/redeem API yet — a FrappeAdapter would use plain REST
   on the doctypes until one exists.

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
