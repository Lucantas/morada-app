# Design — Payments, resident status & monthly condo summary

> Date: 2026-07-14. Source: brainstorming session over eight requested
> adjustments to Morada. This is the source-of-truth spec for the change set.
> Domain terms stay in PT-BR (`pago`/`pendente`/`atrasado`, "Taxa condominial").

## Goal

Make condo payments realistic and month-aware: masked money inputs, cash/pix
only, admin-editable receipts with back-dated payment, an admin override for a
resident's payment status, automatic monthly condo-fee receipts, a
resident-initiated "I paid + proof" flow the admin confirms, and a condo summary
that reports the current month.

## Decisions (from brainstorming)

- **Resident status**: keep the derived payment status; add an admin **override**
  only (no separate administrative status).
- **Monthly generation**: **lazy** — ensured when the admin opens the app in a new
  month (no cron; deploy not done yet).
- **Fee amount**: a single admin-configurable value applied to every apartment.
- **Proof storage**: **base64 data URL in the DB for now**, behind a small
  `ProofStorage` port so it can be swapped for S3 at deploy time.

## Non-negotiables (unchanged)

TDD (failing test first, same commit), coverage ≥ 80%, no `any`/non-null/`console.*`,
immutability, Zod at boundaries, explicit errors, `eslint-plugin-boundaries`
respected (`ui → domain ← data`), conventional atomic commits, never `--no-verify`.

---

## A. Masked money input (item 1)

**Behavior.** A reusable `MoneyInput` with a fixed `R$` prefix rendered inside the
field. The value is held as integer **cents**; typing digits fills from the right
(`R$ 0,00 → R$ 1,50 → R$ 15,00`); backspace pops the last digit; paste keeps only
digits. Free text is impossible.

**Web.**

- New `apps/web/src/shared/ui/money-input.tsx` — controlled: `value: number`
  (cents), `onChange(cents: number)`, plus label/id passthrough. Formats via the
  existing `formatBRL`.
- Replace the plain "Valor (R$)" text fields in
  `apps/web/src/features/residents/ui/issue-charge-screen.tsx` and
  `apps/web/src/features/accounts/ui/account-edit-screen.tsx` with `MoneyInput`;
  drop the submit-time `parseReaisToCents` at those call sites (value is already
  cents). `parseReaisToCents` stays only if another caller needs it; otherwise
  remove it and its test.

**Storage.** Unchanged — DB already stores integer `value_cents`.

**Tests.** `money-input.test.tsx`: initial `R$ 0,00`; sequential digits;
backspace; paste with separators; emits correct cents; renders the fixed prefix.

---

## B. Register/edit receipts + back-dated payment (item 2)

**Behavior.** Admin can edit an existing receipt and can register a receipt that
is **already paid in the past**.

**API.**

- `editReceipt(repo, id, patch)` app use-case; route `PUT /api/receipts/:id`
  (`requireRole('admin')`). Editable: `ref`, `title`, `valueCents`, `dueDate`.
- Extend create so admin may pass `status: 'pago'` + `method` + `paidAt` (past
  date allowed) to register an already-settled charge. Resident-facing creation
  is unaffected (admin-only route).
- `ReceiptRepository` gains `update(id, patch)` on both the pg adapter and the
  in-memory fake; drives the shared `*-repository.contract.ts`.

**Web.**

- Admin receipt-edit screen reachable from the apartment ledger; uses
  `MoneyInput` + native date inputs. "Dar baixa" already supports a past `paidAt`
  — surface the date field there too.

**Guard.** Only admin edits; resident cannot reach `PUT`.

**Tests.** edit updates only allowed fields; register-as-paid stores `paidAt`;
resident `PUT` → 403.

---

## C. Payment methods: cash & pix only (item 3)

**Behavior.** The only accepted methods are `dinheiro` and `pix`. Any existing
`boleto`/`cartao` becomes `dinheiro`.

**Domain.**

- `receiptMethodSchema` → `z.enum(['dinheiro', 'pix'])` in both
  `apps/api/src/receipts/domain/receipt.ts` and
  `apps/web/src/features/receipts/domain/receipt.ts`.

**Migration `003_payment_methods`.**

- `UPDATE receipts SET method = 'dinheiro' WHERE method IN ('boleto', 'cartao');`

**Web UI.**

- `receipt-status-view.ts` `METHOD_LABELS` → `{ dinheiro: 'Dinheiro', pix: 'Pix' }`.
- `pay-screen.tsx`: two options (Dinheiro, Pix). Pix keeps the QR + copia-e-cola;
  Dinheiro is a plain confirm.
- Fixtures/factories/seed: replace any `boleto`/`cartao` with `dinheiro`/`pix`.

**Tests.** schema rejects `boleto`/`cartao`; migration maps legacy rows;
pay-screen renders exactly the two options.

---

## D. Admin override for resident payment status (item 4)

**Behavior.** The payment status stays **derived** (`em_dia`/`pendente`/`atrasado`).
The admin may **override** it manually and may **clear** the override to return to
automatic derivation. No separate administrative status.

**Data.** `residents.status_override TEXT NULL` (enum `em_dia|pendente|atrasado`).

**API.**

- `deriveResidentStatus` unchanged; `listResidents`/`getResident` app layer:
  `effectiveStatus = override ?? derived`.
- Route `PUT /api/residents/:id/status { status: ResidentStatus | null }`
  (`requireRole('admin')`); `null` clears the override.
- `ResidentRepository` gains `setStatusOverride(id, status | null)` (pg + fake +
  contract).

**Web.**

- Resident edit screen: a status control letting the admin pick a manual status or
  choose "Automático" (clears the override). The pill shows the effective status
  and marks when it is a manual override.

**Tests.** override wins over derived; clearing returns to derived; non-admin → 403.

---

## E. Automatic monthly condo-fee receipts (lazy) (item 5)

**Behavior.** Every active resident owes the monthly condo fee. When the admin
opens the app in a new month, the system ensures each active resident has the
current month's `Taxa condominial` receipt; missing ones are created `pendente`.
Idempotent — never duplicates.

**Config.** New single-row table `condo_settings`:
`monthly_fee_cents INT NOT NULL`, `due_day INT NOT NULL DEFAULT 15`. Endpoints
`GET /api/settings` and `PUT /api/settings` (`requireRole('admin')`). Web admin
"Configurações" screen edits `monthly_fee_cents` with `MoneyInput` and the due day.

**Generation.**

- App use-case `ensureMonthlyReceipts({ residents, receipts, settings, today })`
  → pure function returning the receipts to create: for each **active** resident
  lacking a receipt with `ref = MM/YYYY` (current month) and `title = 'Taxa
condominial'`, build one with `valueCents = settings.monthlyFeeCents`,
  `dueDate = <due_day>/<current month>`, `status = 'pendente'`, apartment from the
  resident's occupancy.
- Route `POST /api/receipts/ensure-month` (`requireRole('admin')`) applies it;
  idempotent (guarded by `ref` + `residentId`). The admin dashboard triggers it on
  load. Residents see the receipts once the admin has opened the app that month.
- **Documented limitation.** Generation is admin-load-triggered, not a real cron;
  a scheduled job is deferred to deploy.

**Tests.** creates one per active resident missing the month; skips residents who
already have it (idempotent); ignores inactive residents; correct `ref`/`value`/
`dueDate`; second call creates nothing.

---

## F. Resident submits payment + proof; admin confirms (item 6)

**Behavior.** A resident marks a receipt as paid and attaches a proof; the receipt
enters review; only the admin confirms it as paid (or rejects it back to pending).

**Receipt status.** Enum becomes `pendente | em_analise | pago`
(`receiptStatusSchema`, web + api). No migration of existing rows (both current
values remain valid).

**Data.** `receipts.proof TEXT NULL` (base64 data URL), `receipts.submitted_at
DATE NULL`. On submit, `method` holds the resident-declared method.

**Proof storage abstraction.** `ProofStorage` port (`save(dataUrl) → ref`,
`load(ref) → dataUrl`). Current adapter stores the data URL inline in
`receipts.proof`; an S3 adapter is a later swap. Validate on the boundary: allowed
MIME (`image/*`, `application/pdf`) and a max size (e.g. 5 MB) via Zod.

**API.**

- `POST /api/receipts/:id/submit-payment { method, proof }` (resident, owns the
  receipt) → `status = 'em_analise'`, stores `method`, `proof`, `submitted_at =
today`. Does **not** set `pago`/`paidAt`.
- `POST /api/receipts/:id/confirm { paidAt? }` (admin) → `status = 'pago'`,
  `paidAt` (admin may back-date), keeps `method`.
- `POST /api/receipts/:id/reject` (admin) → `status = 'pendente'`, clears `proof`
  and `submitted_at`.

**Web.**

- Resident: "Registrar pagamento" — pick method, upload the proof (file → data
  URL), submit → the receipt shows **"Em análise"**.
- Admin ledger: receipts `em_analise` surface a "Ver comprovante" + **Confirmar** /
  **Rejeitar**.

**Tests.** submit sets `em_analise` + stores proof, not `pago`; non-owner submit →
403; confirm sets `pago` + `paidAt`; reject clears proof + returns `pendente`;
proof MIME/size validation rejects bad input.

---

## G. "Contas — Pagos do mês" reflects the current month only (item 7)

**Behavior.** The "Contas pagas" figure counts only accounts dated in the current
month.

**Shared helper.** `apps/web/src/shared/lib/dates.ts` + api equivalent gain
`currentMonthRange(today) → { start, end }` (ISO `YYYY-MM-DD`, inclusive month
bounds).

**Change.** Paid-accounts sum filters `status === 'pago' && date` within the
current month. See H for the exact dashboard shape.

**Tests.** an account from a previous month is excluded; one dated this month is
included; boundary days (1st/last) included.

---

## H. Month-aware condo summary widget (item 8)

**Behavior.** The `BalanceHero` widget (admin **and** resident) shows:

- **Saldo do condomínio** — total cash: all-time `pago` receipts − all-time `pago`
  accounts.
- **Entradas do mês** — sum of `pago` receipts with `paidAt` in the current month.
- **Contas pagas** — sum of `pago` accounts with `date` in the current month.

**API.**

- `buildDashboardSummary(accounts, receipts, today)` returns
  `balance: { balanceCents }`, `monthIncomeCents`, `monthPaidCents`, plus the
  existing `recentPaid`/`maintenances`. `DashboardSummary` schema updated (web
  mirror too).
- `dashboard` pg adapter query updated to compute all-time balance + the two
  month sums (pass the month bounds as params).

**Web.**

- `dashboard-screen.tsx` and `resident-finance-screen.tsx`: relabel/rewire the
  three figures to `balanceCents` / `monthIncomeCents` / `monthPaidCents`.

**Tests.** balance stays all-time; `monthIncomeCents` counts only this month's
paid receipts (by `paidAt`); `monthPaidCents` only this month's paid accounts (by
`date`); previous-month items excluded.

---

## Migrations (append-only, numbered in creation order, next is `003`)

Numbered to match the phase order below so they run in the order they were created.

1. `003_payment_methods` (phase 1) — `UPDATE receipts SET method='dinheiro' WHERE
method IN ('boleto','cartao')`.
2. `004_condo_settings` (phase 2) — `CREATE TABLE condo_settings (id TEXT PRIMARY
KEY, monthly_fee_cents INTEGER NOT NULL, due_day INTEGER NOT NULL DEFAULT 15)` +
   seed a single `default` row (fee from the current hand-entered value, e.g.
   15000).
3. `005_receipt_review` (phase 3) — `ALTER TABLE receipts ADD COLUMN proof TEXT`,
   `ADD COLUMN submitted_at DATE`. (`em_analise` is enum-only, no column change.)
4. `006_resident_status_override` (phase 3) — `ALTER TABLE residents ADD COLUMN
status_override TEXT`.

Each migration is transactional and mirrored in the pg migrations list; adapters
read new DATE columns with the `::text` cast (as `002_dates` already does).

## Phasing (three atomic, gate-green commits)

1. **Money & reporting** — A (MoneyInput + swap two inputs), C (methods +
   migration `003`), G (contas month filter), H (month-aware summary).
2. **Receipts admin & monthly** — condo settings (migration `004`), lazy
   `ensureMonthlyReceipts`, B (edit/register + back-dated paid).
3. **Payment workflow & status** — F (`em_analise` + submit/confirm/reject + proof
   base64, migration `005`), D (status override, migration `006`).

Each phase keeps `make check` (web) and `make api-check` (api) green and coverage
≥ 80%.

## Out of scope / deferred

- Real S3 proof storage and a scheduled (cron) monthly generation — both land at
  deploy; the `ProofStorage` port and the lazy generator make them a clean swap.
- Per-apartment fee values (single global fee for now).
- A separate administrative resident status (only the payment override is built).
