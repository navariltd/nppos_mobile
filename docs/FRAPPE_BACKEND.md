# The Frappe backend (aigt_hdr) — what the mobile app needs to know

The backend is a custom Frappe/ERPNext app called **aigt_hdr** (lives at
`frappe-bench/apps/aigt_hdr`, not in this repo). It has ~150 doctypes across four
modules (`AIGT HDR`, `Non Profit`, `Beneficiaries`, `Grievances`), but **only a
handful matter for the POS app** — all in the `Beneficiaries` module. This doc is
the distilled version so you don't have to read the backend source.

## The doctypes that matter

| Doctype | Naming | What it is |
|---|---|---|
| **Beneficiary** | — | Master record: full_name, id_number, phone, household_size, territory/district, beneficiary_type, is_proxy. Linked to an ERPNext **Supplier** (payments are made to the supplier) and a **Bank Account**. Child table `beneficiary_nos` (Beneficiary Donor Assignment) holds per-donor/project **beneficiary_no + entitlement_amount + currency** — i.e. the same person can have different beneficiary numbers and entitlements per project. |
| **Disbursement Order (DO)** | `DON-DBSE-.YYYY.-` | The driving document. `disbursement_type`: **Cash / Physical Goods / Services**, plus `mode_of_payment`. Two child tables: `items` (Disbursement Order Item — item_code, qty, rate, donor) for goods, and `beneficiaries` (Disbursement Order Party — beneficiary, **agent**, amount, mode_of_payment, bank snapshot, is_proxy, verified) for who gets what. Carries project, cost_center, company bank account, currency, description. Submittable. |
| **Agent Disbursement Assignment (ADA)** | `AA-.YYYY.-` | **The per-agent slice of a DO** — this is what the app pulls as "my assignment". Fields: agent (Employee), disbursement_order, date, project, amount_to_disburse, amount_to_receive (incl. bank fees), and a `beneficiaries` child table (reuses **Verification Request Item**: beneficiary, beneficiary_no, amount, currency, mode_of_payment, bank snapshot, status Open/Verified/Not Verified). Submittable. |
| **Payment Entry** (ERPNext core + custom fields) | `ACC-PAY-` | One per beneficiary cash payout. Created as **draft** by the backend when an ADA is submitted (see flow below), with custom fields: agent, agent_assignment, disbursement_order, beneficiary, is_proxy. `reference_no` = ADA name is used as the duplicate guard. |
| **Collection Reconciliation** | `DCR-.YY.-` | End-of-day reconciliation for **cash** DOs. Fields: date, disbursement_order, agent, agent_assignment, **payment_proof (attach, required)**, and child table `payment_entries` (Payment Entry Table: payment_entry, beneficiary, amount). On submit it **submits all the listed draft Payment Entries**. Duplicate protection: a Payment Entry can appear in only one reconciliation. |
| **Verification Request** | `PV-.YYYY.-` | Only for **bank-transfer** (non-cash-in-hand) payouts: beneficiaries' bank accounts get verified before payment. Grouped Personal / Proxy (per focal point) / missing-bank. Not a POS-app concern for v1. |
| **Agent Fund Transfer** | `AFT-.YY.-.MM.-` | Moves float between two agents (creates a Journal Entry). Useful later for the agent cash-management screens. |

Supporting cast: **Focal Point** (proxy account holder for beneficiaries without
bank accounts), **Territory/District** (location), **AIGT HDR Settings** (single
doc holding per-company GL accounts: agent accounts, beneficiary accounts, bank
charges accounts).

### Entitlement Voucher / Entitlement Redemption → separate app

These two doctypes live in the **nppos** Frappe app (the web POS), *not* in
aigt_hdr. They are fully documented in **`docs/NPPOS_WEB.md`** — read that for
fields, controller behavior (redemption auto-creates Payment/Stock Entries on
submit), custom fields, and known gaps.

### POS Profile / Opening / Closing (ERPNext standard)

The app models an agent's shift the ERPNext way — these are core doctypes, not
custom:

- **POS Profile** — per-agent POS configuration (company, warehouse, currency,
  payment methods, applicable users). Pulled to the local `pos_profiles` table.
  The backend will link its custom doctypes (e.g. Entitlement Redemption) to it.
- **POS Opening Entry** — starts a shift: `period_start_date`, `pos_profile`,
  `user`, and `balance_details` (mode of payment + opening amount). The app's
  "Open session" (dashboard) creates a local `pos_sessions` row and queues this
  doc with the counted opening cash float.
- **POS Closing Entry** — ends the shift, linked back to its opening entry
  (`pos_opening_entry`, required): period end, `payment_reconciliation` rows
  (mode of payment, opening / expected / closing amount, difference). The app's
  reconciliation screen closes the session with counted cash and queues this.
  Note our POS pays cash **out**, so expected = opening float − payouts (the
  inverse of a sales POS).

## The cash flow (the important one)

```
Disbursement Order (type Cash, submitted)
  │  create_agent_assignments()  — groups DO beneficiary rows by agent
  ▼
Agent Disbursement Assignment (one per agent, with beneficiary child rows)
  │  on submit → process_beneficiary_payment()
  │    mode_of_payment == Cash → creates one DRAFT Payment Entry per beneficiary
  │    (party = beneficiary's Supplier; reference_no = ADA name → re-runs skip
  │     already-created ones; bank fee goes into a deductions row)
  ▼
Agent goes to the field and hands out physical cash        ← THE APP LIVES HERE
  ▼
Collection Reconciliation (per agent/DO, requires payment_proof attachment)
  │  pulls "eligible" Payment Entries: payment_type=Pay, docstatus=0 (draft),
  │  same DO/agent/ADA, not already in another reconciliation
  │  on submit → submits those Payment Entries (money officially moves in GL)
  ▼
Done. GL: agent account → beneficiary account, per AIGT HDR Settings.
```

**Key insight for the app:** the backend pre-creates *draft* Payment Entries at
assignment time. The agent's field work (our POS transaction) is what turns a
draft into a confirmed payout, and Collection Reconciliation is the batch
"submit" step. So when we sync a cash payout, we are *not* creating a Payment
Entry — we're telling the backend "this draft was actually paid" (and at day end
the reconciliation groups + submits them). This maps cleanly onto our
`pos_transactions` + end-of-day reconciliation screen.

## The goods flow

On a **Physical Goods** DO, `make_stock_entries()` creates one **Stock Entry
(Material Issue)** per beneficiary from a source warehouse, linked to the DO and
project. Note: today this runs from the DO itself (back office), **not**
per-agent — there's no goods equivalent of the ADA yet. For the app's
goods-issue flow we record locally and will need a backend method (or custom
fields on Stock Entry) that accepts agent-side issues at sync time.

## What does NOT exist in the backend (yet)

These are mobile-side concepts for now — don't go hunting for their doctypes:

- **Entitlement** (POS sense) — our `entitlements` table generalizes "what this
  beneficiary/voucher gets". Backend-side that's spread across DO Party rows
  (cash amount), DO Items (goods), and the new Entitlement Voucher. (There *is*
  an `Entitlement Request` doctype, but it's a service-desk thing — unrelated.)
- **Hamper** — backend just uses ERPNext Items/BOMs; DO items are flat item
  lines. Our `hampers`/`hamper_items` tables are a local presentation of that.
- **Card/bank withdrawal flow** — nothing in the backend; it's a future
  real-time bank API integration (online-only in the app).

(Vouchers *do* exist now — see **Entitlement Voucher / Entitlement Redemption**
above. Ignore any older note saying otherwise; the plain `voucher` references
in ERPNext core are GL internals, still unrelated.)

## Local table → backend mapping (for the future FrappeAdapter)

| Local table (pull) | Backend source |
|---|---|
| `projects` | Project (created per DO) |
| `disbursement_orders` | Disbursement Order (submitted, agent has an ADA on it) |
| `assignments` | Agent Disbursement Assignment for the logged-in agent |
| `beneficiaries` | ADA child rows (joined w/ Beneficiary master) — *only the agent's slice* |
| `vouchers` | **Entitlement Voucher** (agent's slice) |
| `entitlements` | Derived from ADA rows (cash amount) + DO items (goods) + Entitlement Voucher |
| `hampers`, `hamper_items` | Item / BOM referenced by the DO |
| `agent_stock` | Bin levels of the agent's warehouse |
| `pos_profiles` | **POS Profile** for the logged-in agent |

| Local table (push) | Backend target |
|---|---|
| `pos_transactions` type `cash_payment` | Confirm the matching draft Payment Entry (idempotent via our client UUID) |
| `pos_transactions` type `goods_issue` | Stock Entry (Material Issue) — needs new backend method |
| `voucher_redemptions` | **Entitlement Redemption** (one per voucher use) |
| `pos_sessions` open | **POS Opening Entry** (opening cash float) |
| `pos_sessions` close (reconciliation screen) | **POS Closing Entry** (+ Collection Reconciliation with payment proof) |

Roles: backend already defines a **Non Profit Agent** role with create/write on
ADA and Collection Reconciliation — that's the API user profile the app will
authenticate as.

## v1 scope reminder

First implementation is deliberately incomplete: capture the important stuff in
SQLite (schema in `src/db/schema.ts`), run the app on seeded dummy data, refine
locally, *then* build sync. Nothing above about the FrappeAdapter is built yet.
