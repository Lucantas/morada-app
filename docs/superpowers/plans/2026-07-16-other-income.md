# Other Income Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Outras entradas" (non-fee income) ledger — a new `income` feature (CRUD with proof) on the admin Contas screen — and make it count toward the dashboard's monthly income and all-time balance.

**Architecture:** New API `income` feature (mirrors `accounts`), a broadened pure `buildDashboardSummary` that also sums incomes, and web work: income feature + an income editor screen + an "Outras entradas" section on the accounts screen. Domain pure; boundaries preserved.

**Tech Stack:** Hono + Postgres API (hexagonal), Vite + React 19 web (TS strict), Jest + Testing Library, TanStack Query, Zustand nav.

## Global Constraints

- No `any`, no non-null assertions (`!`), no `console.*`. Immutability. Comments only when extremely necessary. Design tokens only.
- pnpm. API tests: `pnpm --filter @morada/api test <pattern>`; web: `pnpm --filter @morada/web test <pattern>`. Gates: `make api-check`, `make check` (local Postgres up).
- Migrations append-only in `apps/api/src/platform/postgres/migrations.ts`; next id is `008_incomes`. Table reset list is `DATA_TABLES` in `apps/api/src/test-support/pg.ts` — add `'incomes'`.
- An income is money received: it has a `date` (nullable) and NO status. Every income counts toward income totals.
- `accounts` is the API reference feature to mirror for the income module; the web `accounts` feature mirrors the web income feature. Reuse the shared `proofSchema` from `apps/api/src/receipts/domain/proof.ts` (API) and `receipts/domain/proof.ts` `fileToDataUrl`/`isAllowedProof` (web).
- Conventional commits; never `--no-verify`.

---

## Task 1: API — broaden `buildDashboardSummary` to include incomes

**Files:** Modify `apps/api/src/dashboard/domain/build-dashboard-summary.ts` + `build-dashboard-summary.test.ts`.

**Interfaces:**

- Produces: `LedgerIncome { valueCents: number; date: string | null }`; new signature `buildDashboardSummary(accounts, receipts, incomes, today)`.

- [ ] **Step 1: Update the failing tests** — in `build-dashboard-summary.test.ts`, every existing `buildDashboardSummary(accounts, receipts, TODAY)` call becomes `buildDashboardSummary(accounts, receipts, incomes, TODAY)`. Add a shared `const incomes: LedgerImport... ` fixture and new cases:

```ts
// add to imports: LedgerIncome
const incomes: LedgerIncome[] = [
  { valueCents: 10000, date: '2026-04-10' }, // this month
  { valueCents: 5000, date: '2026-01-02' }, // earlier — all-time only
  { valueCents: 2000, date: null }, // undated — all-time only
];

test('income of the month adds paid receipts and this-month incomes', () => {
  // 90000 (2 paid receipts this month) + 10000 (one income this month) = 100000
  expect(buildDashboardSummary(accounts, receipts, incomes, TODAY).balance.incomeCents).toBe(
    100000,
  );
});

test('balance adds all-time incomes to all-time paid receipts, minus paid expenses', () => {
  // (90000 + 10000+5000+2000) - 363000
  expect(buildDashboardSummary(accounts, receipts, incomes, TODAY).balance.balanceCents).toBe(
    90000 + 17000 - 363000,
  );
});
```

Update the three pre-existing balance/income/paid tests to pass `[]` as `incomes` (their expected numbers are unchanged when incomes is empty). Keep the `recentPaid`/`maintenances` tests, adding `[]` for incomes.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/api test build-dashboard-summary`
Expected: FAIL — signature arity / new expectations.

- [ ] **Step 3: Implement**

In `build-dashboard-summary.ts`, add the type and broaden the function:

```ts
export interface LedgerIncome {
  valueCents: number;
  date: string | null;
}
```

Change the signature and the two income sums:

```ts
export function buildDashboardSummary(
  accounts: LedgerAccount[],
  receipts: LedgerReceipt[],
  incomes: LedgerIncome[],
  today: string,
): DashboardSummary {
  const paidAccounts = accounts.filter((a) => a.status === PAID);
  const paidReceipts = receipts.filter((r) => r.status === PAID);

  const allTimeIncome = sum(paidReceipts) + sum(incomes);
  const allTimePaid = sum(paidAccounts);
  const monthIncome =
    sum(paidReceipts.filter((r) => sameMonth(r.paidAt, today))) +
    sum(incomes.filter((i) => sameMonth(i.date, today)));
  const monthPaid = sum(paidAccounts.filter((a) => sameMonth(a.date, today)));
  // ...rest unchanged (recentPaid, maintenances, return)
}
```

(`sum` already accepts `{ valueCents }[]`; `sameMonth` already handles `null`.)

- [ ] **Step 4: Keep the caller compiling** — the pg dashboard adapter calls the old 3-arg signature, and the pre-commit hook runs a project-wide `tsc`, so every commit must compile. In `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts`, pass an empty incomes array to the new parameter for now: `return buildDashboardSummary(accounts, receipts, [], today);` (Task 3 replaces `[]` with a real `incomes` query). No behavior change — an empty incomes array yields the same summary as before.

- [ ] **Step 5: Run test + gate to verify**

Run: `pnpm --filter @morada/api test build-dashboard-summary` (PASS), then `pnpm --filter @morada/api exec tsc --noEmit` (compiles).
Expected: PASS + clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/dashboard/domain/build-dashboard-summary.ts apps/api/src/dashboard/domain/build-dashboard-summary.test.ts apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts
git commit -m "feat(api): count other income in the dashboard summary"
```

---

## Task 2: API — income domain, migration, pg adapter, contract

Mirror `accounts`. Read `apps/api/src/accounts/domain/{account.ts,account-repository.ts,errors.ts}`, `accounts/adapters/postgres/account-repository.ts`, `accounts/adapters/account-repository.contract.ts` and its pg test.

- [ ] **Step 1: Domain**

```ts
// apps/api/src/income/domain/income.ts
import { z } from 'zod';

import { proofSchema } from '../../receipts/domain/proof';

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)');

export const incomeSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(200),
  source: z.string().min(1).max(120),
  date: isoDateSchema.nullable(),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  proofDataUrl: proofSchema.optional(),
});
export type Income = z.infer<typeof incomeSchema>;

export const incomeDraftSchema = incomeSchema.extend({ id: z.string().min(1).optional() });
export type IncomeDraft = z.infer<typeof incomeDraftSchema>;
```

```ts
// apps/api/src/income/domain/errors.ts
export class IncomeValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'IncomeValidationError';
  }
}
export class IncomeNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Entrada não encontrada: ${id}`);
    this.name = 'IncomeNotFoundError';
  }
}
```

```ts
// apps/api/src/income/domain/income-repository.ts
import type { Income } from './income';

export interface IncomeRepository {
  list(): Promise<Income[]>;
  getById(id: string): Promise<Income | null>;
  save(income: Income): Promise<Income>;
  delete(id: string): Promise<void>;
}
```

> Confirm the exact `proofSchema` export path in `receipts/domain/proof.ts`; if it isn't exported there, export it (it was introduced in the inline-receipt-card sub-project). If `isoDateSchema` already exists in a shared spot, import it instead of redeclaring.

- [ ] **Step 2: Migration `008_incomes`** — append to the migrations array:

```ts
  {
    id: '008_incomes',
    sql: `
CREATE TABLE incomes (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  date DATE,
  proof_data_url TEXT
);
`,
  },
```

- [ ] **Step 3: pg adapter** — mirror `PostgresAccountRepository`, adding `source`, `proof_data_url`, and `date::text`. Implement `list` (ORDER BY date DESC NULLS LAST), `getById`, `save` (INSERT … ON CONFLICT (id) DO UPDATE), `delete` (DELETE WHERE id). Read the account adapter for the exact `$N`-param + `col::text` date pattern; map `proof_data_url` with `?? undefined` on read and pass `proofDataUrl ?? null` on write.

- [ ] **Step 4: Contract + pg test** — mirror `accounts/adapters/account-repository.contract.ts` + its pg test: `save` then `getById` round-trips (including `date` and `proofDataUrl`); `list` returns saved; `save` again updates; `delete` removes; `getById` unknown → null. Reset via `resetPg` with `'incomes'` added to `DATA_TABLES` (`apps/api/src/test-support/pg.ts`).

- [ ] **Step 5: Run** `pnpm --filter @morada/api test income` (contract + any unit) — PASS (pg is up). Do not run the full gate yet (dashboard adapter still compiles against Task 1's new signature only after Task 3).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/income apps/api/src/platform/postgres/migrations.ts apps/api/src/test-support/pg.ts
git commit -m "feat(api): income domain, migration, and Postgres repository"
```

---

## Task 3: API — income use-cases, routes, composition, dashboard wiring

**Files:** create `apps/api/src/income/app/{list-incomes,get-income,save-income,delete-income}.ts` (+ tests for save/delete), `apps/api/src/income/adapters/http/routes.ts`; modify `platform/repositories.ts`, `compose.ts`, `dashboard/adapters/postgres/dashboard-repository.ts`, `dashboard/adapters/dashboard-repository.contract.ts`.

- [ ] **Step 1: Use-cases** (mirror `accounts/app/save-account.ts` + `get-account.ts`):

- `list-incomes.ts`: `listIncomes(repo) → repo.list()`.
- `get-income.ts`: `getIncome(repo, id)` → throws `IncomeNotFoundError` if null.
- `save-income.ts`: `saveIncome(repo, input)` — `incomeDraftSchema.safeParse`; on failure throw `IncomeValidationError`; assign `id ?? randomUUID()`; `incomeSchema.parse`; `repo.save`.
- `delete-income.ts`: `deleteIncome(repo, id)` — `getById`; if null throw `IncomeNotFoundError`; else `repo.delete(id)`.

Write `save-income.test.ts` (valid create; invalid → `IncomeValidationError`; update keeps id) and `delete-income.test.ts` (deletes; unknown → `IncomeNotFoundError`) with a fake repo (mirror `create-receipt.test.ts`'s fakeRepo shape). TDD: failing test → implement → pass (`pnpm --filter @morada/api test income`).

- [ ] **Step 2: Routes**

```ts
// apps/api/src/income/adapters/http/routes.ts
import { Hono } from 'hono';
import type { ApiEnv } from '../../../platform/auth';
import { deleteIncome } from '../../app/delete-income';
import { getIncome } from '../../app/get-income';
import { listIncomes } from '../../app/list-incomes';
import { saveIncome } from '../../app/save-income';
import type { IncomeRepository } from '../../domain/income-repository';

export function incomeRoutes(repo: IncomeRepository): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await listIncomes(repo)));
  app.post('/', async (c) => c.json(await saveIncome(repo, await c.req.json())));
  app.put('/:id', async (c) =>
    c.json(await saveIncome(repo, { ...(await c.req.json()), id: c.req.param('id') })),
  );
  app.delete('/:id', async (c) => {
    await deleteIncome(repo, c.req.param('id'));
    return c.body(null, 204);
  });
  return app;
}
```

(`getIncome` is imported for parity/future use; if lint flags it unused, drop the import.)

- [ ] **Step 3: DI + composition** — `platform/repositories.ts`: add `incomes: new PostgresIncomeRepository(pool)` + type. `compose.ts`: destructure `incomes`; mount `api.route('/incomes', guarded('admin', incomeRoutes(incomes)))` after `/accounts` + the import.

- [ ] **Step 4: Dashboard wiring** — in `PostgresDashboardRepository.getSummary()`, replace the temporary `[]` (from Task 1) with a real incomes query and pass it:

```ts
const incomesResult = await this.pool.query<{ value_cents: number; date: string | null }>(
  'SELECT value_cents, date::text AS date FROM incomes',
);
const incomes = incomesResult.rows.map((row) => ({ valueCents: row.value_cents, date: row.date }));
// ...
return buildDashboardSummary(accounts, receipts, incomes, today);
```

The `PostgresDashboardRepository` constructor takes only a `Pool`, so no new dependency — it queries `incomes` directly (same as it already queries `accounts`/`receipts`). Update the `dashboard-repository.contract.ts` if it asserts specific numbers: add an income row via the contract's setup and assert it's reflected in `incomeCents`/`balanceCents` (read the contract to see its current fixtures; extend minimally). If the contract takes repos in its factory, the dashboard pg test already provides `accounts`/`receipts` — add `incomes: new PostgresIncomeRepository(pool)` there so the contract can seed an income.

- [ ] **Step 5: Verify** — `pnpm --filter @morada/api test income` and `pnpm --filter @morada/api test dashboard`, then `make api-check` (full gate; the branch compiles again now). Expected: PASS (≥80%).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/income apps/api/src/platform/repositories.ts apps/api/src/compose.ts apps/api/src/dashboard
git commit -m "feat(api): income endpoints and dashboard inclusion"
```

---

## Task 4: Web — income feature (domain, data, hooks)

Mirror the web `accounts` feature (`apps/web/src/features/accounts/{domain,data,ui/use-accounts.ts}`). Read them + `shared/lib/api-client.ts` (constructor-injected `ApiClient`) + `receipts/domain/proof.ts`.

Create:

- `features/income/domain/income.ts` (`incomeSchema` id/description/source/date(nullable)/valueCents/proofDataUrl?; `Income`; `IncomeDraft = { id?; description; source; date; valueCents; proofDataUrl? }`).
- `features/income/domain/income-repository.ts` (`IncomeRepository { list; save(draft) → Income; remove(id) }`).
- `features/income/data/http-income-repository.ts` (constructor `ApiClient`; `GET /api/incomes`; create `POST /api/incomes`; update `PUT /api/incomes/:id`; `remove` `DELETE /api/incomes/:id`; zod-parse responses).
- `features/income/data/in-memory-income-repository.ts` (test fake).
- `features/income/ui/use-income.ts` (`incomeQueryKey`, `useIncomes`, `useSaveIncome`, `useDeleteIncome` — mutations invalidate `incomeQueryKey` AND `['dashboard']`).

No dedicated test (exercised by Tasks 5-6). Run the web typecheck + `pnpm --filter @morada/web test income` (no tests found is fine). Commit: `feat(web): income feature repository and hooks`.

---

## Task 5: Web — income editor screen

**Files:** create `apps/web/src/features/accounts/ui/income-edit-screen.tsx` (+ test); modify `app/nav-store.ts` (add `'a-income-edit'`), `app/app.tsx` (route it), `app/container.ts` (income repo).

> The income editor lives under `accounts/ui` (Outras entradas are part of the Contas surface). It may import `income/domain` + `income/ui` + `receipts/domain/proof`.

- [ ] **Step 1: nav-store** — add `| 'a-income-edit'` to the `View` union.

- [ ] **Step 2: The screen** — `IncomeEditScreen` props `{ incomeId?: string; repository: IncomeRepository; onBack: () => void }`. Load the income (if `incomeId`) via `useIncomes`+find or a `getById`; local form `{ description, source, date, valueCents, proofDataUrl }`. Fields: Descrição (`Field`), Origem (`Field`), Valor (`MoneyInput`), Data (`Field type="date"`), "Anexar comprovante" (file → `fileToDataUrl`/`isAllowedProof`). "Salvar entrada" → `useSaveIncome().mutateAsync({ id: incomeId, ...form })` then `onBack`. When editing, an "Excluir entrada" button opens a `ConfirmDialog` (reuse `@/shared/ui/confirm-dialog`, `tone="danger"`, "Excluir entrada?"); confirm → `useDeleteIncome().mutateAsync(incomeId)` then `onBack`. Header mirrors other admin editors ("Contas · Outras entradas" eyebrow + `Nova entrada`/`Editar entrada`). Validation: description+source non-empty, valueCents>0.

- [ ] **Step 3: Test** — `income-edit-screen.test.tsx` (mirror an existing editor test like `account-edit-screen.test.tsx`): saving a new income calls the repo `save` with the entered fields; for an existing income, clicking "Excluir entrada" then confirming calls `remove(id)`. Use `renderWithClient` + `InMemoryIncomeRepository` + awaited `userEvent`. TDD: fail → implement → pass.

- [ ] **Step 4: app.tsx + container** — `container.ts`: `export const incomeRepository = new HttpIncomeRepository(apiClient);` (match how other repos are built). `app.tsx`: add a `case 'a-income-edit':` rendering `<IncomeEditScreen incomeId={residentId /* reuse the nav param, or add an income id param */} repository={incomeRepository} onBack={() => go('a-accounts')} />`. If the nav store's single `residentId` param is unsuitable, add an `incomeId?` to `nav-store` `go` opts and thread it (mirror how `residentId` is passed). Keep it minimal.

- [ ] **Step 5:** Run `pnpm --filter @morada/web test income-edit-screen` then the full `pnpm --filter @morada/web test`. Commit: `feat(web): income editor screen with proof and delete`.

---

## Task 6: Web — "Outras entradas" section on the accounts screen

**Files:** modify `apps/web/src/features/accounts/ui/accounts-screen.tsx` (+ test); `app/app.tsx` (pass income repo + open-editor handler to `AccountsScreen`).

- [ ] **Step 1: Test** (append to `accounts-screen.test.tsx`): with an `InMemoryIncomeRepository` seeded with one income, the "Outras entradas" section renders its description; clicking "Adicionar" (in that section) calls the open-new-income handler; clicking an income row calls open with its id. Empty repo → an `EmptyState` "Nenhuma entrada registrada". Use `renderWithClient` + awaited `userEvent`.

- [ ] **Step 2: Implement** — `AccountsScreen` gains props `incomeRepository: IncomeRepository` and `onOpenIncome: (id?: string) => void`. Below the accounts list, render a `SectionLabel` "Outras entradas" with an "Adicionar" action calling `onOpenIncome()`; load incomes via `useIncomes(incomeRepository)`; list each (`SurfaceCard`: description + `source` secondary + `R$ value`) calling `onOpenIncome(income.id)`; `EmptyState` (icon `bank`) "Nenhuma entrada registrada" when empty; `StatusView` for loading/error (reuse SP1 primitives).

- [ ] **Step 3: app.tsx** — pass `incomeRepository={incomeRepository}` and `onOpenIncome={(id) => go('a-income-edit', { incomeId: id })}` (or the nav param chosen in Task 5) to `<AccountsScreen>`.

- [ ] **Step 4:** Run `pnpm --filter @morada/web test accounts-screen` then full `pnpm --filter @morada/web test`. Commit: `feat(web): outras entradas section on the accounts screen`.

---

## Task 7: Final gates

- [ ] **Step 1:** `make api-check` — PASS (income contract + dashboard reflects incomes).
- [ ] **Step 2:** `make check` — PASS (≥80%).
- [ ] **Step 3:** If web coverage dips, add a focused test (income editor proof-attach or the accounts-screen empty state). Commit any additions.

---

## Self-review notes

- **Spec coverage:** dashboard sum → T1; income domain/migration/pg/contract → T2; income use-cases/routes/wiring + dashboard load → T3; web income feature → T4; editor (+ delete/proof) → T5; Contas section → T6; gates → T7.
- **Every commit compiles:** T1 changes `buildDashboardSummary`'s signature AND passes a temporary `[]` in the pg adapter so the project typechecks; T3 swaps `[]` for the real income query. No non-compiling intermediate.
- **Type consistency:** `buildDashboardSummary(accounts, receipts, incomes, today)`; `IncomeRepository` (api `list/getById/save/delete`, web `list/save/remove`); income fields `description/source/date/valueCents/proofDataUrl?` aligned across api + web.
- **Deliberate:** income has no status (always counts); only income has delete (accounts/receipts delete stays deferred); `dashboardSummarySchema` unchanged.
