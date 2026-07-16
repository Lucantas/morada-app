# Apartment ledger overview · archive receipts/accounts · accounts filter

Date: 2026-07-16
Status: approved

Four related improvements to the admin experience, all against the existing
apartment-keyed model. No new backend entities — a soft-delete flag plus derived,
client-side views.

## 1. Soft-delete (archive) for receipts and accounts

"Excluir" is a soft archive, not a hard delete: the row stays, a `visible` flag
flips to false, and archived rows disappear from every list and every total.

### Data

- Migration `009_visible` (append to `apps/api/src/platform/postgres/migrations.ts`):
  - `ALTER TABLE receipts ADD COLUMN visible boolean NOT NULL DEFAULT true;`
  - `ALTER TABLE accounts ADD COLUMN visible boolean NOT NULL DEFAULT true;`
- `visible` is an infrastructure/persistence concern, **not** part of the domain
  `Receipt`/`Account` schemas. The domain entities stay unchanged; the repositories
  own the flag.

### Repository behaviour (API, Postgres adapters + shared contracts)

- Every read that returns a list or a single row filters `WHERE visible = true`:
  - receipts: `list`, `listByResident`, `listByApartment`, `getById`
  - accounts: `list`, `getById`
  - dashboard queries: the paid-receipts and paid-accounts SELECTs add
    `AND visible = true` so archived rows do not count toward saldo / entradas / pago.
- New repository method on both `ReceiptRepository` and `AccountRepository`:
  `archive(id): Promise<void>` → `UPDATE … SET visible = false WHERE id = $1`.
  A `getById` (visible-only) that returns null after archiving is the 404 signal.

### Use cases (API `app/`)

- `archiveReceipt(repo, id)` and `archiveAccount(repo, id)`: `getById` → if null throw
  the feature's NotFoundError (404) → `repo.archive(id)`. Mirror `deleteIncome`'s shape.

### HTTP (admin-only, mounted where the other receipt/account routes are)

- `DELETE /api/receipts/:id` → `archiveReceipt` → 204 (404 if missing).
- `DELETE /api/accounts/:id` → `archiveAccount` → 204 (404 if missing).

### Web

- `ReceiptRepository` (web `receipts/data`) and `AccountRepository` (web `accounts/data`)
  gain `archive(id)` → HTTP `DELETE`. In-memory versions drop the row (tests).
- Hooks: `useArchiveReceipt`, `useArchiveAccount` (mutation → invalidate the relevant
  query keys incl. `['dashboard']`).
- UI:
  - Receipt: an **Excluir** button in the ledger row (`ReceiptLedgerRow` in
    resident-edit), next to Editar/Dar baixa, guarded by `ConfirmDialog`
    ("Excluir este recibo?"). On confirm → archive → the row disappears.
  - Account: an **Excluir** button on the account edit screen
    (`account-edit-screen`, mirroring the income editor's delete), guarded by
    `ConfirmDialog`. On confirm → archive → navigate back to Contas.

### Out of scope

Income keeps its existing hard delete. Consistency (making income soft-delete too)
is a noted follow-up, not part of this change.

## 2. Apartment financial summary (enrich resident-edit)

No new screen. Inside `ReceiptsSection` (resident-edit), above the receipt list,
show a small two-tile summary derived client-side from the already-loaded apartment
receipts:

- **Recebido**: sum of `valueCents` of receipts with status `pago`.
- **Em aberto**: sum of `valueCents` of receipts with status `pendente` or `em_analise`.

Pure helper `apartmentReceiptTotals(receipts)` in `receipts/domain` returns
`{ paidCents, openCents }`. Unit-tested. Rendered with the existing token styles
(reuse the header-tile pattern from the accounts screen if convenient).

## 3. Sort apartment receipts by due date, newest first

Pure helper `sortByDueDateDesc(receipts)` in `receipts/domain`: returns a new array
sorted by `dueDate` descending; receipts with a null `dueDate` sort last; ties keep a
stable order (by id). Applied in `ReceiptsSection` before mapping the ledger rows.
Immutable (no in-place sort). Unit-tested + a component test asserting row order.

## 4. Accounts filter (name / category / date range)

A filter bar on the accounts screen (`accounts-screen`) above the list:

- **Nome**: text input, substring match, accent- and case-insensitive, against
  `account.description`.
- **Categoria**: a select whose options are the distinct categories present in the
  loaded accounts (plus a "Todas" default). No extra fetch.
- **Período**: two native date inputs (`de` / `até`), inclusive, matched against
  `account.date`; a null-date account is excluded when either bound is set.

Pure helper `filterAccounts(accounts, { query, category, from, to })` in
`accounts/domain` returns the filtered array (immutable). The screen holds the filter
state (`useState`) and renders `filterAccounts(accounts.data ?? [], filters)`. The
income "Outras entradas" section is unaffected. Unit-tested (helper) + a component
test (typing a name / picking a category / setting a range narrows the visible rows).

## Testing

- API: use-case tests for `archiveReceipt`/`archiveAccount` (404 + archive), contract
  tests for `archive` + visible-filtering on both adapters, route tests
  (`DELETE` → 204, 404, resident → 403), and a dashboard test proving an archived paid
  receipt/account is excluded from the totals.
- Web: unit tests for `apartmentReceiptTotals`, `sortByDueDateDesc`, `filterAccounts`;
  component tests for the Excluir + confirm flow (receipt ledger, account edit), the
  apartment summary + ordering, and the accounts filter. Keep coverage ≥ 80%.

## Execution

Subagent-driven, one task per subagent, review between:

- **A (API)** — migration `009_visible`; `archive` on receipt/account repos + contracts;
  `archiveReceipt`/`archiveAccount` use cases; `DELETE` routes; visible-filter across
  receipt/account/dashboard queries; tests.
- **B (web data)** — `archive` on web receipt/account repos (+ in-memory) and hooks.
- **C (web UI: delete)** — Excluir + ConfirmDialog on the receipt ledger row and the
  account edit screen; wire through app.tsx/container.
- **D (web: apartment overview)** — `apartmentReceiptTotals` + `sortByDueDateDesc` and
  the summary tiles + ordering in `ReceiptsSection`.
- **E (web: accounts filter)** — `filterAccounts` + the filter bar on the accounts screen.

Ordering: A → B → C, then D and E (independent of each other) after B.
