# Apartment ledger overview · archive · accounts filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add soft-delete (archive) for receipts and accounts, an apartment financial summary + due-date ordering on the resident-edit ledger, and a name/category/date-range filter on the accounts screen.

**Architecture:** A persistence-only `visible` boolean (default true) on `receipts` and `accounts`; every read filters `visible = true`, and "Excluir" flips it false. The apartment summary, receipt ordering, and accounts filter are pure domain helpers rendered client-side. No new domain entities.

**Tech Stack:** Vite+React 19 (web), Hono + Postgres (api), Zod, TanStack Query, Jest + Testing Library. pnpm. Design from `docs/superpowers/specs/2026-07-16-apartment-ledger-archive-filter-design.md`.

## Global Constraints

- TDD: failing test before implementation, in the same commit. Coverage ≥ 80% (domain near 100%).
- No `any`, no non-null assertions, no `console.*`. Immutability — never mutate inputs.
- Validate at boundaries (Zod). Conventional commits, small and atomic. Never `--no-verify`.
- Architecture boundaries are lint-enforced (TS resolver now active): `ui → domain ← data`; api `domain` pure, `app` never imports adapters. `visible` is NOT added to the domain `Receipt`/`Account` Zod schemas.
- Status vocab: receipts `pendente`/`em_analise`/`pago`; accounts `pago`/`pendente`/`atrasado`.
- Web tests run `pnpm --filter @morada/web test`; API tests `make api-test` (Postgres `morada_test`, never `morada`). Single lint invocation: `pnpm --filter @morada/<app> exec eslint src`.

---

### Task A: Migration 009_visible + visible-filter on all reads

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (append migration `009_visible`)
- Modify: `apps/api/src/receipts/adapters/postgres/receipt-repository.ts` (add `AND visible = true` to every SELECT: `list`, `listByResident`, `listByApartment`, `getById`)
- Modify: `apps/api/src/accounts/adapters/postgres/account-repository.ts` (add `AND visible = true` to `list`, `getById`)
- Modify: `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts` (add `WHERE visible = true` to the receipts and accounts SELECTs)
- Test: `apps/api/src/receipts/adapters/receipt-repository.contract.ts`, `apps/api/src/accounts/adapters/account-repository.contract.ts` (add a "hidden rows are excluded" case — see steps)

**Interfaces:**

- Consumes: existing pg pool, existing repository classes.
- Produces: DB column `receipts.visible` / `accounts.visible` (boolean not null default true); all reads exclude `visible = false`.

- [ ] **Step 1: Add the migration.** In `migrations.ts`, append to the `migrations` array after `008_incomes`:

```ts
  {
    id: '009_visible',
    sql: `
ALTER TABLE receipts ADD COLUMN visible boolean NOT NULL DEFAULT true;
ALTER TABLE accounts ADD COLUMN visible boolean NOT NULL DEFAULT true;
`,
  },
```

- [ ] **Step 2: Write a failing contract case for receipts.** In `receipt-repository.contract.ts`, inside the shared describe, add a test that seeds two receipts, flips one hidden directly, and asserts it is gone from `list`/`listByApartment`/`getById`. Because `archive` doesn't exist yet, drive visibility via a raw UPDATE helper the contract already has access to, OR (simpler) defer this assertion to Task B where `archive` exists. **Decision:** move the hidden-exclusion assertions into Task B (they need `archive`). In Task A only assert the migration applies and existing tests still pass.

- [ ] **Step 3: Add `AND visible = true` to every receipt SELECT.** Edit each query string in `receipt-repository.ts` so the WHERE clause includes `visible = true` (for `list`: `WHERE visible = true`; for the scoped ones: `AND visible = true`). Same for `account-repository.ts` (`list`, `getById`).

- [ ] **Step 4: Add `visible = true` to the dashboard SELECTs.** In `dashboard-repository.ts`, the receipts query becomes `... FROM receipts WHERE visible = true` and the accounts query `... FROM accounts WHERE visible = true`.

- [ ] **Step 5: Run the API suite.** `make api-test` → all existing tests PASS (new column defaults true, so nothing is hidden yet).

- [ ] **Step 6: Commit.**

```bash
git add apps/api/src/platform/postgres/migrations.ts apps/api/src/receipts/adapters/postgres/receipt-repository.ts apps/api/src/accounts/adapters/postgres/account-repository.ts apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts
git commit -m "feat(api): add visible flag and filter archived rows from reads"
```

---

### Task B: archive() repo method + archive use cases + DELETE routes

**Files:**

- Modify: `apps/api/src/receipts/domain/receipt-repository.ts` (add `archive(id): Promise<void>`)
- Modify: `apps/api/src/accounts/domain/account-repository.ts` (add `archive(id): Promise<void>`)
- Modify: `apps/api/src/receipts/adapters/postgres/receipt-repository.ts`, `.../accounts/.../account-repository.ts` (implement `archive`)
- Modify: `apps/api/src/receipts/adapters/receipt-repository.contract.ts`, `.../account-repository.contract.ts` (contract test for `archive` + hidden exclusion)
- Create: `apps/api/src/receipts/app/archive-receipt.ts` + `.test.ts`; `apps/api/src/accounts/app/archive-account.ts` + `.test.ts`
- Modify: `apps/api/src/receipts/adapters/http/routes.ts` (add `DELETE /:id`), `apps/api/src/accounts/adapters/http/routes.ts` (add `DELETE /:id`)
- Modify: `apps/api/src/compose.test.ts` (route tests: 204, 404, resident 403; dashboard excludes archived)
- Check existing NotFoundError: `apps/api/src/receipts/domain/errors.ts`, `apps/api/src/accounts/domain/errors.ts` (reuse `ReceiptNotFoundError`/`AccountNotFoundError`; add if missing, mirroring `IncomeNotFoundError` with `status = 404`).

**Interfaces:**

- Consumes: `ReceiptRepository`/`AccountRepository` (now with `getById` visible-only + `archive`).
- Produces: `archiveReceipt(repo, id): Promise<void>` (404 if not found), `archiveAccount(repo, id): Promise<void>`; `DELETE /api/receipts/:id` and `DELETE /api/accounts/:id` → 204.

- [ ] **Step 1: Add `archive` to the repo interfaces.** Add `archive(id: string): Promise<void>;` to both domain repository interfaces.

- [ ] **Step 2: Failing contract test (receipts).** In `receipt-repository.contract.ts`, add:

```ts
test('archive hides a receipt from every read', async () => {
  const repo = await makeRepo([/* two visible receipts a,b in apt-1 */]);
  await repo.archive('a');
  expect(await repo.getById('a')).toBeNull();
  expect((await repo.list()).map((r) => r.id)).not.toContain('a');
  expect((await repo.listByApartment('apt-1')).map((r) => r.id)).toEqual(['b']);
});
```

Mirror the same for accounts (`list` + `getById`). Match the contract file's existing seeding helper.

- [ ] **Step 3: Run → FAIL** (`archive` undefined). `make api-test`.

- [ ] **Step 4: Implement `archive` on both pg adapters.**

```ts
async archive(id: string): Promise<void> {
  await this.pool.query('UPDATE receipts SET visible = false WHERE id = $1', [id]);
}
```

(accounts version updates `accounts`). Run the contract tests → PASS.

- [ ] **Step 5: Failing use-case test.** `archive-receipt.test.ts` (mirror `income/app/delete-income.test.ts`): a fake repo; archiving a missing id throws `ReceiptNotFoundError`; archiving an existing id calls `repo.archive(id)`. Same for `archive-account.test.ts`.

- [ ] **Step 6: Implement the use cases.**

```ts
// archive-receipt.ts
import { ReceiptNotFoundError } from '../domain/errors';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function archiveReceipt(repo: ReceiptRepository, id: string): Promise<void> {
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  await repo.archive(id);
}
```

(accounts analog with `AccountNotFoundError`). Run → PASS.

- [ ] **Step 7: Add the DELETE routes.** In `receipts/adapters/http/routes.ts` add `app.delete('/:id', async (c) => { await archiveReceipt(repo, c.req.param('id')); return c.body(null, 204); });` — mount position must not be shadowed by `/:id/...` routes. Same in accounts routes.

- [ ] **Step 8: Route + dashboard tests in compose.test.ts.** Add: resident `DELETE /api/receipts/x` → 403; admin `DELETE` a seeded paid receipt → 204, then it is gone from `/api/apartments/:id/receipts`; admin `DELETE` missing → 404; a dashboard test proving an archived paid receipt/account no longer counts in the summary. Mirror accounts.

- [ ] **Step 9: Run `make api-test` → all PASS. Then `pnpm --filter @morada/api exec eslint src` → clean.**

- [ ] **Step 10: Commit.**

```bash
git add apps/api/src/receipts apps/api/src/accounts apps/api/src/compose.test.ts
git commit -m "feat(api): archive (soft-delete) receipts and accounts via DELETE"
```

---

### Task C: Web data — archive on repos + hooks

**Files:**

- Modify: `apps/web/src/features/receipts/domain/receipt-repository.ts` (add `archive`), `.../receipts/data/http-receipt-repository.ts`, `.../receipts/data/in-memory-receipt-repository.ts` (+ `.test.ts`)
- Modify: `apps/web/src/features/accounts/domain/account-repository.ts`, `.../accounts/data/http-account-repository.ts`, `.../accounts/data/in-memory-account-repository.ts` (+ `.test.ts`)
- Modify: `apps/web/src/features/receipts/ui/use-receipts.ts` (or wherever receipt hooks live — check; create `useArchiveReceipt`), `apps/web/src/features/accounts/ui/use-accounts.ts` (add `useArchiveAccount`)

**Interfaces:**

- Consumes: `ApiClient.del(path)`.
- Produces: web `ReceiptRepository.archive(id)`, `AccountRepository.archive(id)`; hooks `useArchiveReceipt(repo)`, `useArchiveAccount(repo)` (invalidate the feature key + `['receipts']`/`['dashboard']`).

- [ ] **Step 1: Add `archive` to both web repo interfaces.** `archive(id: string): Promise<void>;`

- [ ] **Step 2: Failing in-memory repo test.** In `in-memory-receipt-repository.test.ts`: seed one receipt, `await repo.archive(id)`, expect `await repo.getById(id)` is null and `list()` empty. Same for accounts.

- [ ] **Step 3: Implement in-memory `archive`** (delete from the Map, immutably):

```ts
async archive(id: string): Promise<void> {
  const next = new Map(this.receipts);
  next.delete(id);
  this.receipts = next;
}
```

- [ ] **Step 4: Implement http `archive`.** `async archive(id: string): Promise<void> { await this.api.del(\`/api/receipts/${id}\`); }` (accounts: `/api/accounts/${id}`). Add a `http-*-repository.test.ts`case asserting`del` is called with the right path (mirror income's http test).

- [ ] **Step 5: Add the hooks** (mirror `useDeleteIncome`): `useArchiveReceipt` invalidates `['receipts']`, `residentsQueryKey`, `['dashboard']`; `useArchiveAccount` invalidates `accountsQueryKey`, `['dashboard']`.

- [ ] **Step 6: Run `pnpm --filter @morada/web test` (the touched suites) → PASS; `eslint src` clean.**

- [ ] **Step 7: Commit.** `git commit -m "feat(web): archive receipts and accounts through the repositories"`

---

### Task D: Web UI — Excluir buttons + ConfirmDialog

**Files:**

- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (add an Excluir button + ConfirmDialog to `ReceiptLedgerRow`; thread an `onArchiveReceipt` handler like the other receipt actions) + `.test.tsx`
- Modify: `apps/web/src/features/accounts/ui/account-edit-screen.tsx` (add an Excluir button + ConfirmDialog, mirroring the income editor's delete; on confirm → archive → `onBack`) + `.test.tsx`
- Modify: `apps/web/src/app/app.tsx` (wire `onArchiveReceipt` into the resident-edit route via a `container.archiveReceipt`; pass an archive handler to `AccountEditScreen`)
- Modify: `apps/web/src/app/container.ts` (export `archiveReceipt(id)` and `archiveAccount(id)` thin wrappers over the repos, if that is the container's pattern — otherwise pass the repo + hook down as the account/income editors already do)

**Interfaces:**

- Consumes: `useArchiveReceipt`, `useArchiveAccount`, `ConfirmDialog` (`open`, `title`, `message`, `confirmLabel`, `tone`, `isPending`, `onConfirm`, `onCancel`).
- Produces: user-visible Excluir flow that archives and refreshes.

- [ ] **Step 1: Failing test — account edit delete.** In `account-edit-screen.test.tsx`: render editing an existing account with an archive handler; click "Excluir", confirm in the dialog, expect the archive handler called with the id and `onBack` called. (Mirror the income-edit delete test.)

- [ ] **Step 2: Implement account Excluir.** Add a secondary "Excluir" button (only when `accountId` is set) that opens a `ConfirmDialog` ("Excluir este lançamento?"); on confirm call the archive mutation then `onBack`. Wire the mutation via `useArchiveAccount(repository)`.

- [ ] **Step 3: Failing test — receipt ledger delete.** In `resident-edit-screen.test.tsx`: seed an apartment receipt, click "Excluir" on its row, confirm, expect the archive handler called with the receipt id.

- [ ] **Step 4: Implement receipt Excluir.** In `ReceiptLedgerRow`, add an "Excluir" button next to Editar/Dar baixa (guarded so it also shows for paid receipts — soft delete is allowed for any status), opening a `ConfirmDialog` ("Excluir este recibo?"); on confirm call the threaded `onArchiveReceipt(receipt.id)`. Thread `onArchiveReceipt` through `ReceiptsSection` → `ReceiptLedgerRow` like `onConfirmPayment`.

- [ ] **Step 5: Wire app.tsx/container.** Add archive wiring: resident-edit gets `onArchiveReceipt`; account-edit gets the archive path. Follow the existing `confirmPayment`/`issueCharge` wiring style.

- [ ] **Step 6: Run `pnpm --filter @morada/web test` → PASS; `eslint src` clean; `tsc --noEmit` clean.**

- [ ] **Step 7: Commit.** `git commit -m "feat(web): excluir (archive) receipts and accounts with confirmation"`

---

### Task E: Apartment summary + due-date ordering

**Files:**

- Create: `apps/web/src/features/receipts/domain/apartment-receipt-totals.ts` + `.test.ts`
- Create: `apps/web/src/features/receipts/domain/sort-by-due-date.ts` + `.test.ts`
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (`ReceiptsSection`: render the summary tiles + apply the sort) + `.test.tsx`

**Interfaces:**

- Consumes: `Receipt` (`receipts/domain/receipt`).
- Produces: `apartmentReceiptTotals(receipts: Receipt[]): { paidCents: number; openCents: number }`; `sortByDueDateDesc(receipts: Receipt[]): Receipt[]`.

- [ ] **Step 1: Failing test — totals.**

```ts
import { apartmentReceiptTotals } from './apartment-receipt-totals';
test('sums paid vs open (pendente + em_analise)', () => {
  const r = (id: string, status: string, valueCents: number) =>
    ({ id, status, valueCents }) as never;
  expect(
    apartmentReceiptTotals([
      r('a', 'pago', 15000),
      r('b', 'pendente', 15000),
      r('c', 'em_analise', 15000),
      r('d', 'pago', 5000),
    ]),
  ).toEqual({ paidCents: 20000, openCents: 30000 });
});
```

- [ ] **Step 2: Implement `apartmentReceiptTotals`** (pure reduce; `pago` → paidCents; `pendente`/`em_analise` → openCents). Run → PASS.

- [ ] **Step 3: Failing test — sort.**

```ts
import { sortByDueDateDesc } from './sort-by-due-date';
test('orders by dueDate desc, nulls last, stable by id', () => {
  const mk = (id: string, dueDate: string | null) => ({ id, dueDate }) as never;
  const out = sortByDueDateDesc([mk('a', '2026-04-15'), mk('b', null), mk('c', '2026-06-15')]);
  expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b']);
});
test('does not mutate the input', () => {
  const input = [{ id: 'a', dueDate: '2026-01-01' }] as never[];
  sortByDueDateDesc(input);
  expect(input).toHaveLength(1);
});
```

- [ ] **Step 4: Implement `sortByDueDateDesc`** (copy the array; compare `dueDate` desc with null last; tie-break by `id`). Run → PASS.

- [ ] **Step 5: Failing component test.** In `resident-edit-screen.test.tsx`: seed apartment receipts out of order + mixed statuses; assert the summary tiles show the expected "Recebido"/"Em aberto" amounts and the rows render most-recent-due first.

- [ ] **Step 6: Implement in `ReceiptsSection`.** Compute `const ordered = sortByDueDateDesc(receipts);` and `const totals = apartmentReceiptTotals(receipts);` render two tiles above the list (reuse the accounts `HeaderTile` styling pattern inline), map `ordered` instead of `receipts`. Run → PASS.

- [ ] **Step 7: `eslint src` + `tsc` clean; commit.** `git commit -m "feat(web): apartment receipt summary and due-date ordering"`

---

### Task F: Accounts filter (name / category / date range)

**Files:**

- Create: `apps/web/src/features/accounts/domain/filter-accounts.ts` + `.test.ts`
- Modify: `apps/web/src/features/accounts/ui/accounts-screen.tsx` (filter bar + state; render filtered rows) + `.test.tsx`

**Interfaces:**

- Consumes: `Account` (`accounts/domain/account`).
- Produces: `filterAccounts(accounts: Account[], filters: { query: string; category: string; from: string; to: string }): Account[]` — empty string means "no constraint" for that field; `category` matches exactly (or "" = all); `from`/`to` are inclusive ISO dates against `account.date` (a null-date account is excluded when either bound is set); `query` is accent/case-insensitive substring on `description`.

- [ ] **Step 1: Failing test — filter helper.** Cover: query narrows by description (accent-insensitive: "agua" matches "Água"); category exact; from/to inclusive; null-date excluded when a bound is set; empty filters return all.

- [ ] **Step 2: Implement `filterAccounts`** (pure; normalize with `.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()` for the query; combine predicates). Run → PASS.

- [ ] **Step 3: Failing component test.** In `accounts-screen.test.tsx`: seed accounts across categories/dates; type a name → only matching rows; pick a category → only that category; set a date range → only in-range. Reuse the existing test setup (note the income section is a slot — pass `incomeSection={null}`; if the setup already passes a slot, keep it).

- [ ] **Step 4: Implement the filter bar.** Add filter `useState` (`query`, `category`, `from`, `to`); a text input (aria-label "Buscar por nome"), a `<select>` (options = distinct `account.category` values from `accounts.data`, plus a "Todas" default = ""), two date inputs (aria-labels "De"/"Até"). Render `filterAccounts(accounts.data ?? [], filters)` in the list. Keep the empty-state when the filtered result is empty.

- [ ] **Step 5: `eslint src` + `tsc` clean; run `pnpm --filter @morada/web test` full → PASS (coverage ≥ 80%).**

- [ ] **Step 6: Commit.** `git commit -m "feat(web): filter accounts by name, category and date range"`

---

## Execution order

A → B → C → D. Then E and F (independent) in either order. Each task ends green (its suite + lint + typecheck) before the next starts.
