# Sync API contract — mobile ⇄ nppos Frappe app

The mobile `FrappeAdapter` (`src/services/api/frappe/`) is **already written
against this contract**. The next step is implementing the three whitelisted
methods below in the **nppos** Frappe app (Python). Wire format is snake_case;
every response goes through Frappe's standard `{ "message": ... }` envelope.

Auth after login: `Authorization: token <api_key>:<api_secret>` on every
request. The API user needs the **Non Profit Agent** role (see
FRAPPE_BACKEND.md §Roles).

---

## 1. `POST /api/method/nppos.api.login`

Request:

```json
{ "email": "amina.wanjiru@nppos.org", "password": "..." }
```

Behavior: validate credentials (`frappe.auth`), ensure/generate the user's API
key + secret, and return them with the agent's profile **and the user's
distribution-enabled POS profiles** — the app upserts those into SQLite right
away so the post-login profile picker works before any `sync_pull` has run.

Response `message`:

```json
{
  "token": "api_key:api_secret",
  "agent": {
    "id": "AGT-014",
    "name": "Amina Wanjiru",
    "email": "amina.wanjiru@nppos.org",
    "warehouse_code": "WH-NRB-014",
    "role": "agent",
    "region": "Nairobi — Kibra"
  },
  "pos_profiles": [
    { "id": "POSP-001", "name": "Kibra Field POS", "agent_id": "AGT-014",
      "warehouse": "WH-NRB-014", "currency": "KES" }
  ]
}
```

`role` is `"admin"` when the user has an admin-level role, else `"agent"`.
`pos_profiles` = the same rows `sync_pull` returns, filtered to POS Profiles
where this user is an applicable user **and** `enable_entitlement_distribution
= 1`. Invalid credentials → HTTP 401 with a readable `message`.

**Token handling (device side):** the returned `token` is written to the OS
keystore (expo-secure-store), held in memory by the adapter for the
`Authorization` header, and restored on relaunch — it is **never** persisted in
Redux/AsyncStorage, and the password is never stored at all.

---

## 2. `POST /api/method/nppos.api.sync_push`

One call = one queued business transaction from the device outbox.

Request:

```json
{
  "client_ref": "6f0f2c6e-…",            // client UUID — THE idempotency key
  "created_at": "2026-07-21T09:12:00Z",  // device time; server also stamps its own
  "payload": { "kind": "cash_payment", ... }
}
```

**Idempotency (hard requirement):** the device re-pushes the same `client_ref`
whenever a response is lost after the server already committed, so every
handler must answer a retry with **accepted + the existing doc's name**, never
a second document. Two mechanisms, by doctype:

- **Entitlement Redemption, Stock Entry** — `client_ref` is a unique Data field
  on the doc (installed by `nppos/install.py`); look the retry up by it. These
  have no natural key: a second redemption of the same amount on the same
  voucher is a legitimate business event.
- **POS Opening/Closing Entry** — no field; the shift is the key. An opening is
  identified by `(pos_profile, user, period_start_date)` — `period_start_date`
  is stamped from the payload's `created_at`, which a retry resends unchanged.
  A closing is identified by its `pos_opening_entry` link, since a shift closes
  once. The opening check must run **before** any stale-session cleanup, or the
  cleanup auto-closes the live shift the retry belongs to.

**Atomicity:** everything one payload creates happens in one DB transaction
(whitelisted methods are transactional by default — don't `frappe.db.commit()`
midway).

Response `message` — exactly one of:

```json
{ "status": "accepted", "server_name": "ACC-PAY-2026-00119",
  "related": { "entitlement_redemption": "ENT-RED-2026-07-0001" } }   // optional

{ "status": "rejected", "reason": "Voucher V-2026-88232 already redeemed twice." }
```

- `rejected` (HTTP 200) = **valid business refusal** (voucher over limit,
  expired, entitlement revoked). The device marks the transaction `conflict`
  for admin review and will NOT retry it.
- HTTP 5xx / network = transient; the device backs off and retries the same
  `client_ref`.
- HTTP 401/403 = auth problem; the device stops and surfaces it.

### Payload kinds → ERPNext documents

| `payload.kind` | Fields | Server creates |
|---|---|---|
| `cash_payment` | `entitlement`, `amount`, `voucherNo?`, `beneficiary?`, `posSession` | Voucher (`voucherNo` set): **Entitlement Redemption** (insert+submit; its controller auto-creates the Payment Entry — do NOT create one separately, see NPPOS_WEB.md). Beneficiary/ADA cash: confirm the matching **draft Payment Entry** (FRAPPE_BACKEND.md cash flow). Re-validate voucher status/validity/uses server-side. |
| `goods_issue` | `entitlement`, `hamper`, `qty`, `warehouse`, `voucherNo?`, `beneficiary?`, `posSession` | Voucher: **Entitlement Redemption** (goods type → auto Stock Entry). Beneficiary: **Stock Entry (Material Issue)** from `warehouse`, linked to project/DO. |
| `stock_return` / `stock_damaged` | `warehouse`, `hamper`, `qty` | **Stock Entry** out of `warehouse` (damaged → write-off target per company settings). |
| `pos_opening` | `posProfile`, `openingFloat` | **POS Opening Entry** (cash mode, one balance row = the float). `period_start_date` comes from `created_at` — it is half the retry key, so don't substitute server time. |
| `pos_closing` | `session`, `openingFloat`, `paidOut`, `expectedCash`, `countedCash`, `difference`, `autoClosed`, `photo?` | **POS Closing Entry** linked to the POS Opening Entry **named** by `payload.session`. Note: a disbursement POS pays cash OUT (expected = float − payouts). `autoClosed: true` = counted was assumed at sign-out, flag for review. |

`pos_closing.photo` is the optional close-out photo (a signed distribution
sheet or fingerprint slip) — `{ name, mime, data }` with `data` base64. The
handler attaches it as a private **File** on the closing entry; it must never be
fatal (a bad image cannot be allowed to strand an agent mid-close) and must skip
when the doc already carries an attachment, so a retry doesn't duplicate it.
Closing is online-only, so the image ships inside the push rather than as a
separate upload — one request, one idempotency key, no orphan files.

`cash_payment` / `goods_issue` must stamp **`pos_opening_entry`** on the
Entitlement Redemption from `payload.posSession` (not just `pos_profile`). The
POS Closing Entry autofills its Linked Redemptions child table from submitted
redemptions sharing its `pos_opening_entry` — without the stamp that table comes
out empty. Goods redemptions also copy the voucher's `bom`.

Session refs (`pos_closing.session`, `posSession`) arrive as POS Opening Entry
**document names**: opening a shift is online-only and pushed immediately, so
the device knows the server name before anything references it (it rewrites its
local session id on the way out — `resolveSessionRefs` in
`src/repositories/sync.ts`). Other internal refs (`entitlement`, …) stay
client-side ids resolved via `client_ref`.

---

## 3. `POST /api/method/nppos.api.sync_pull`

Delta pull of the authenticated agent's slice. Request:

```json
{ "cursors": { "beneficiaries": "2026-07-20T18:00:00Z", ... } }
```

Missing/empty cursor for a collection = first pull → return the full set.
Filter every collection by `modified > cursor` AND by the agent (their ADAs,
their vouchers, their warehouses' bins, POS Profiles where the user is an
applicable user **and** `enable_entitlement_distribution = 1`).

Response `message` — all collections (empty arrays when nothing changed) plus
new cursors (typically "now", per collection):

```json
{
  "assignments":   [{ "id", "agent_id", "project", "disbursement_order",
                      "date", "amount_to_disburse" }],
  "vouchers":      [{ "id", "voucher_no", "beneficiary_no", "entitlement_type",
                      "amount", "hamper_id", "bom_id", "qty", "uom", "rate",
                      "redeemed_amount", "redeemed_qty", "valid_from",
                      "valid_to", "status", "uses_count", "max_uses",
                      "project", "assignment_id", "image", "doc" }],
  "boms":          [{ "id", "item_code", "item_name", "quantity", "uom",
                      "items": [{ "item_code", "item_name", "unit", "qty" }] }],
  "hampers":       [{ "id", "name", "bom_id", "items": [{ "item_name", "unit",
                      "qty_per_household" }] }],
  "agent_stock":   [{ "warehouse", "hamper_id", "hamper_name", "bom_id",
                      "on_hand", "issued_today", "damaged" }],
  "pos_profiles":  [{ "id", "name", "agent_id", "warehouse", "currency" }],
  "beneficiaries": [{ "id", "full_name", "id_number", "status", "phone",
                      "household_size", "beneficiary_type", "district" }],
  "cursors":       { "vouchers": "2026-07-21T09:15:00Z", ... }
}
```

`boms` carries what a hamper actually contains (backend: BOM + BOM Item). Two
sources feed it: the BOM a goods voucher **names** (`Entitlement Voucher.bom`,
surfaced as `vouchers[].bom_id`) — that's what the agent hands over — and the
default BOM of each stock item (`agent_stock[].bom_id`), so the stock screen can
show what one unit in the warehouse holds. They are not always the same BOM.
Vouchers issued before the backend gained `bom` have `bom_id: null`; the device
then falls back to the item's default-BOM expansion in `hampers[].items`.

`beneficiaries` covers only the parties on the vouchers being returned, and only
the identity fields an agent needs to confirm the person in front of them — name,
ID number, status. Vouchers whose `party_type` isn't `Beneficiary` (walk-ins,
merchant vouchers) contribute nothing here.

Voucher `image` is the QR the backend generates on save (nppos
`entitlement_voucher.py`): a public, site-relative file url
`/files/<voucher_number>-qr.png`. The QR **encodes the voucher number itself**
(== the doc name), which is what the device's scanner reads — the file name is
only a fallback, and a lossy one for voucher numbers containing `/` (the server
writes those as `-`). Rendering the image in-app needs connectivity; scanning
does not.

Vocabulary notes: voucher `status` uses the Entitlement Voucher select
lowercased with underscores (`active`, `partially_redeemed`, `redeemed`,
`expired` — Draft/Cancelled never reach the device); `entitlement_type` maps
Goods→`hamper`, Cash→`cash`.

---

## Backend prerequisites (from ARCHITECTURE.md §4 + NPPOS_WEB.md gaps)

1. `client_ref` — unique Data field on Entitlement Redemption and Stock Entry
   (`nppos/install.py`, run via `after_migrate`). POS Opening/Closing Entry use
   their natural keys instead — see Idempotency above.
2. Voucher re-validation on redemption (status/validity/max-uses) — currently
   missing in the Entitlement Redemption controller (NPPOS_WEB.md gaps 1–3);
   `sync_push` must enforce it and answer `rejected` on failure.
3. Redemption should update the voucher's status (gap 1) so `sync_pull`
   reflects reality on other devices.
4. The three methods above, `@frappe.whitelist()`, in the nppos app
   (suggested module: `nppos/api.py`).

## Device-side behavior (already implemented, for reference)

- Push is FIFO per device; a transport failure stops the flush (order
  preserved), backoff = 5s·2^attempt capped at 10min.
- `rejected` → local status `conflict` + reason shown in "needs review";
  resolution is an **admin** action, done **online**.
- Pull upserts skip vouchers/entitlements that still have pending local
  pushes ("local pending wins" until resolved).
