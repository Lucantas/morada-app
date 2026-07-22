# Code follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the four verified code follow-ups: delete the API's dead `active-notices`, use a domain error on the dismiss race, make `saveCategories` atomic, and convert income to soft-delete.

**Architecture:** All API-side except the small web rename in Task 4. Migrations are append-only in `apps/api/src/platform/postgres/migrations.ts` (next id `011`). Spec: `docs/superpowers/specs/2026-07-22-code-followups-design.md`.

**Tech Stack:** Hono + pg, Jest (api suite runs against a live test Postgres via `make api-test`), React/TanStack Query on the web.

## Global Constraints

- **Spec trailer (enforced):** commits touching `apps/api/src/<feature>/**` or `apps/web/src/features/<feature>/**` MUST carry `Spec: docs/superpowers/specs/2026-07-22-code-followups-design.md`.
- **TDD:** failing test before implementation, same commit. Coverage ≥ 80%.
- No `any`, no non-null assertions, no `console.*`; immutability; explicit errors.
- Conventional commits; never `--no-verify`. Run `make api-check` (API tasks) / `make check` (web task) before committing. Format `scripts/`-style files explicitly with prettier if touched (CI checks everything).

---

## Task 1: Delete dead `active-notices` (API)

**Files:**

- Delete: `apps/api/src/notices/app/active-notices.ts`
- Delete: `apps/api/src/notices/app/active-notices.test.ts`

- [ ] **Step 1:** Confirm nothing imports it: `grep -rn "active-notices" apps/api/src` → only the two files themselves.
- [ ] **Step 2:** `git rm apps/api/src/notices/app/active-notices.ts apps/api/src/notices/app/active-notices.test.ts`
- [ ] **Step 3:** `make api-check` → green (deleting a test file lowers totals; coverage still ≥ 80%).
- [ ] **Step 4:** Commit:

```bash
git commit -m "refactor(notices): drop the dead active-notices filter superseded by per-resident dismissals" -m "Spec: docs/superpowers/specs/2026-07-22-code-followups-design.md"
```

---

## Task 2: Domain error on the dismiss race (API)

**Files:**

- Modify: `apps/api/src/notices/adapters/postgres/notice-repository.ts` (the `dismiss` method)
- Test: `apps/api/src/notices/adapters/postgres/notice-repository.test.ts` (or wherever this adapter's contract tests live — find with `grep -rln "dismiss" apps/api/src/notices`)

**Interfaces:**

- Consumes: `NoticeNotFoundError` from `../../domain/errors` (exists; `status = 404`).

- [ ] **Step 1: Failing test** — in the adapter's pg test file, add (adapting to the file's existing setup helpers):

```ts
test('dismiss throws NoticeNotFoundError when the notice vanishes mid-dismiss', async () => {
  await expect(repo.dismiss('missing-notice', 'r-1')).rejects.toBeInstanceOf(NoticeNotFoundError);
});
```

(A dismissal insert for a nonexistent notice id reaches the post-insert `getById` miss — the exact race path. If the `notice_dismissals` FK/constraint rejects the insert first, delete the notice row after inserting it via the test setup instead, then call dismiss; the assertion stays `NoticeNotFoundError`.)

- [ ] **Step 2:** Run the pg adapter test → FAIL (plain `Error`, not `NoticeNotFoundError`).
- [ ] **Step 3:** In `dismiss()`, replace

```ts
if (!notice) throw new Error(`Notice ${noticeId} not found after dismiss`);
```

with

```ts
if (!notice) throw new NoticeNotFoundError(noticeId);
```

adding the import `import { NoticeNotFoundError } from '../../domain/errors';` (merge with any existing errors import).

- [ ] **Step 4:** `make api-check` → green.
- [ ] **Step 5:** Commit:

```bash
git commit -m "fix(notices): raise the domain not-found error on the dismiss race" -m "Spec: docs/superpowers/specs/2026-07-22-code-followups-design.md"
```

---

## Task 3: Atomic `saveCategories` (API)

**Files:**

- Modify: `apps/api/src/categories/domain/category-repository.ts`
- Modify: `apps/api/src/categories/adapters/postgres/category-repository.ts`
- Modify: `apps/api/src/categories/app/save-categories.ts`
- Modify: `apps/api/src/compose.ts` (categories port wiring)
- Tests: the categories pg adapter test + `save-categories` app tests + any in-memory/test fake implementing `CategoryRepository` (find all with `grep -rln "replaceAll" apps/api/src`).

**Interfaces:**

- Produces: `CategoryRepository.replaceAll(categories: Category[], accountUpdates: { id: string; category: string }[]): Promise<Category[]>` — atomic in the pg adapter.
- The `AccountsForReclassify` port becomes `{ list(): Promise<{ id: string; category: string; description: string }[]> }` (no `save`).

- [ ] **Step 1: Failing atomicity test** — in the categories pg adapter test, prove rollback:

```ts
test('replaceAll rolls back account updates when a category insert fails', async () => {
  // seed one account (direct SQL insert into accounts) and one valid category set
  // craft a categories array whose SECOND element violates the schema/PK (e.g. duplicated id)
  // so the insert loop throws after the first UPDATE accounts ran inside the tx
  await expect(
    repo.replaceAll(
      [validCategory, { ...validCategory }], // duplicate id → PK violation on 2nd INSERT
      [{ id: seededAccountId, category: 'NovaCat' }],
    ),
  ).rejects.toThrow();
  const { rows } = await pool.query('SELECT category FROM accounts WHERE id = $1', [
    seededAccountId,
  ]);
  expect(rows[0].category).not.toBe('NovaCat');
});
```

(Adapt setup to the file's existing helpers; the essential assertions are: the call rejects AND the account's category is unchanged afterwards.)

- [ ] **Step 2:** Run → FAIL (current signature has no second parameter; after adding it naively without a tx it would also fail the rollback assertion).
- [ ] **Step 3: Implement.**

`category-repository.ts` (domain):

```ts
import type { Category } from './category';

export type CategoryAccountUpdate = { id: string; category: string };

export interface CategoryRepository {
  list(): Promise<Category[]>;
  replaceAll(categories: Category[], accountUpdates: CategoryAccountUpdate[]): Promise<Category[]>;
}
```

Postgres adapter `replaceAll` — inside the existing BEGIN/COMMIT, after the category inserts:

```ts
for (const update of accountUpdates) {
  await client.query('UPDATE accounts SET category = $2 WHERE id = $1', [
    update.id,
    update.category,
  ]);
}
```

`save-categories.ts` — compute first, persist once:

```ts
export type AccountsForReclassify = {
  list(): Promise<{ id: string; category: string; description: string }[]>;
};

export async function saveCategories(
  repo: CategoryRepository,
  accounts: AccountsForReclassify,
  input: unknown,
): Promise<{ categories: Category[]; reclassified: number }> {
  const parsed = z.array(categoryDraftSchema).safeParse(input);
  if (!parsed.success) throw new CategoryValidationError('Categorias inválidas');
  const categories = parsed.data.map((category, index) =>
    categorySchema.parse({ ...category, id: category.id ?? randomUUID(), position: index }),
  );
  const current = await accounts.list();
  const { changed, reclassified } = reclassifyAccounts(categories, current);
  const saved = await repo.replaceAll(
    categories,
    changed.map((account) => ({ id: account.id, category: account.category })),
  );
  return { categories: saved, reclassified };
}
```

`compose.ts` — the categories port drops its `save` closure (keep `list`); update `categoryRoutes(categories, { list: () => accounts.list() })` accordingly (check `categoryRoutes`'s dep type — it references the port type from save-categories; follow the compile errors).

Update every fake/in-memory `CategoryRepository` (tests) to the new signature — a fake may apply `accountUpdates` to its in-memory accounts array or ignore them if the test doesn't assert on accounts; keep each fake's behavior faithful to what its tests need.

- [ ] **Step 4:** `make api-check` → green (all category tests updated to the new signature).
- [ ] **Step 5:** Commit:

```bash
git commit -m "fix(categories): persist categories and reclassified accounts in one transaction" -m "Spec: docs/superpowers/specs/2026-07-22-code-followups-design.md"
```

---

## Task 4: Income soft-delete (API + web)

**Files (API):**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `011_income_visible`)
- Modify: `apps/api/src/income/domain/income-repository.ts` (`delete` → `archive`)
- Modify: `apps/api/src/income/adapters/postgres/income-repository.ts`
- Rename: `apps/api/src/income/app/delete-income.ts` → `archive-income.ts` (+ its test)
- Modify: `apps/api/src/income/adapters/http/routes.ts` (import/use `archiveIncome`; route stays `DELETE /:id` → 204)
- Modify: `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts` (incomes query filters `visible = true`)
- Tests: income pg adapter test, archive-income use-case test, compose.test.ts income routes, dashboard adapter test if it seeds incomes.

**Files (web):**

- Modify: `apps/web/src/features/income/domain/income-repository.ts` (`remove` → `archive`)
- Modify: `apps/web/src/features/income/data/http-income-repository.ts`
- Modify: `apps/web/src/features/income/ui/use-income.ts` (`useDeleteIncome` → `useArchiveIncome`, calls `repository.archive`)
- Modify: `apps/web/src/features/income/ui/income-edit-screen.tsx` (hook rename; UI copy unchanged)
- Tests: the web income repo/hook/screen tests touching remove/delete (find with `grep -rln "remove\|useDeleteIncome" apps/web/src/features/income`).

- [ ] **Step 1 (API, failing tests):** in the income pg adapter test:

```ts
test('archive hides the income from list and getById but keeps the row', async () => {
  const saved = await repo.save(incomeFixture);
  await repo.archive(saved.id);
  expect(await repo.list()).toEqual([]);
  expect(await repo.getById(saved.id)).toBeNull();
  const { rows } = await pool.query('SELECT visible FROM incomes WHERE id = $1', [saved.id]);
  expect(rows[0].visible).toBe(false);
});
```

And in the dashboard pg adapter test (if it has income seeding; otherwise add): an archived income does not count in the summary.

- [ ] **Step 2:** Run → FAIL (`archive` doesn't exist / column missing).
- [ ] **Step 3 (API, implement):**

Migration (append to the array in `migrations.ts`, after `010_notice_dismissals`):

```ts
  {
    id: '011_income_visible',
    statements: ['ALTER TABLE incomes ADD COLUMN visible boolean NOT NULL DEFAULT true'],
  },
```

(MATCH the exact shape of the existing migration entries — read one first; if entries use a single `sql` string instead of `statements`, follow that.)

Pg repo: `delete` → `archive`:

```ts
  async archive(id: string): Promise<void> {
    await this.pool.query('UPDATE incomes SET visible = false WHERE id = $1', [id]);
  }
```

`list()` adds `WHERE visible = true` (before its ORDER BY); `getById` adds `AND visible = true`. Interface renames `delete` → `archive`. Use case file rename: `archiveIncome(repo, id)` keeps the 404-on-missing behavior of `deleteIncome` (read the old file; only the names change). Route: `app.delete('/:id', …)` now calls `archiveIncome` — path/verb/status unchanged. Dashboard incomes query: `'SELECT value_cents, date::text AS date FROM incomes WHERE visible = true'`.

- [ ] **Step 4 (web, failing test then rename):** update the income tests asserting `remove`/`useDeleteIncome` to the new names first (RED on missing method), then rename: domain interface `archive(id)`, http repo method calls the same `DELETE /api/incomes/:id` endpoint, hook `useArchiveIncome` (same invalidations), screen imports the renamed hook. UI text unchanged.
- [ ] **Step 5:** `make api-check` AND `make check` → green.
- [ ] **Step 6:** Commit (may be two commits — api then web — each with the trailer):

```bash
git commit -m "feat(income): archive incomes instead of hard-deleting (API)" -m "Spec: docs/superpowers/specs/2026-07-22-code-followups-design.md"
git commit -m "feat(income): archive incomes instead of hard-deleting (web)" -m "Spec: docs/superpowers/specs/2026-07-22-code-followups-design.md"
```

---

## Self-Review

- Spec coverage: spec §1→Task 1, §2→Task 2, §3→Task 3, §4→Task 4. Complete.
- Type consistency: `CategoryAccountUpdate` defined in Task 3 domain and consumed by the adapter/app; income `archive(id)` name used consistently across API interface, adapter, use case, route, and web repo/hook.
- Placeholders: test snippets marked "adapt to existing helpers" are setup-mechanical; assertions are fully specified.
