# Settings Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a managed "Categorias de contas" section to the admin Ajustes screen that auto-reclassifies existing accounts by keyword on save, and move settings access from the bottom-nav tab to a gear button in the admin header.

**Architecture:** New API feature `categories` (mirrors the `settings` feature layout) with a pure `reclassifyAccounts` domain function and a `PUT /categories` endpoint that saves the list and reclassifies accounts server-side via a local accounts port (the `createReceipt`/`ResidentApartmentLookup` pattern — no cross-feature import). New web `categories` feature + the Ajustes screen section + a header gear.

**Tech Stack:** Hono + Postgres API (domain/app/adapters/platform, hexagonal), Vite + React 19 web (TS strict), Jest + Testing Library, TanStack Query.

## Global Constraints

- No `any`, no non-null assertions (`!`), no `console.*`. Immutability. Comments only when extremely necessary. Design tokens only.
- pnpm. API tests: `pnpm --filter @morada/api test <pattern>`; web: `pnpm --filter @morada/web test <pattern>`. Gates: `make api-check`, `make check` (both need local Postgres, already up).
- Migrations are append-only in `apps/api/src/platform/postgres/migrations.ts`; next id is `007_categories`.
- API boundaries: `domain` imports only `zod`; `app` must NOT import another feature's `domain`/`adapters` — use a locally-defined port wired at composition (see `create-receipt.ts`'s `ResidentApartmentLookup`).
- `settings` is the reference feature to mirror for the categories module's file layout, repository interface, pg adapter, and `*-repository.contract.ts` shape.
- Conventional commits; never `--no-verify`.
- Normalization used by reclassification: `s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')` (lowercase + strip diacritics).

---

## File structure

**API — create:**

- `apps/api/src/categories/domain/category.ts` — `categorySchema`, `Category`, `categoryDraftSchema`.
- `apps/api/src/categories/domain/errors.ts` — `CategoryValidationError`.
- `apps/api/src/categories/domain/category-repository.ts` — `CategoryRepository` interface.
- `apps/api/src/categories/domain/reclassify.ts` (+ `reclassify.test.ts`) — pure `reclassifyAccounts`.
- `apps/api/src/categories/app/get-categories.ts`, `save-categories.ts` (+ `save-categories.test.ts`).
- `apps/api/src/categories/adapters/postgres/category-repository.ts`.
- `apps/api/src/categories/adapters/category-repository.contract.ts` + `category-repository.pg.test.ts`.
- `apps/api/src/categories/adapters/http/routes.ts`.

**API — modify:** `platform/postgres/migrations.ts` (007), `platform/repositories.ts` (DI), `compose.ts` (mount + accounts port).

**Web — create:** `apps/web/src/features/categories/domain/{category.ts,category-repository.ts}`, `.../data/http-category-repository.ts`, `.../data/in-memory-category-repository.ts`, `.../ui/use-categories.ts`.

**Web — modify:** `features/settings/ui/settings-screen.tsx` (+ test) — Ajustes title + categories section; `app/container.ts` (categoryRepository); `app/app.tsx` (pass categoryRepository to SettingsScreen; add header gear; remove settings from `adminNav`); `features/dashboard/ui/dashboard-screen.tsx` (gear button).

---

## Task 1: API — `reclassifyAccounts` pure function

**Files:**

- Create: `apps/api/src/categories/domain/reclassify.ts`, `apps/api/src/categories/domain/reclassify.test.ts`

**Interfaces:**

- Produces:

```ts
type Categorizable = { id: string; category: string; description: string };
type CategoryRule = { name: string; keywords: string };
export function reclassifyAccounts(
  categories: CategoryRule[],
  accounts: Categorizable[],
): { changed: Categorizable[]; reclassified: number };
```

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/categories/domain/reclassify.test.ts
import { reclassifyAccounts } from './reclassify';

const cats = [
  { name: 'Água', keywords: 'água, saneamento' },
  { name: 'Energia', keywords: 'energia, luz' },
];

describe('reclassifyAccounts', () => {
  test('matches accent- and case-insensitively on description + category', () => {
    const { changed, reclassified } = reclassifyAccounts(cats, [
      { id: 'a1', category: 'Sem categoria', description: 'Conta de AGUA do mês' },
    ]);
    expect(reclassified).toBe(1);
    expect(changed).toEqual([{ id: 'a1', category: 'Água', description: 'Conta de AGUA do mês' }]);
  });

  test('the first matching category (list order) wins', () => {
    const { changed } = reclassifyAccounts(
      [
        { name: 'Energia', keywords: 'conta' },
        { name: 'Água', keywords: 'conta' },
      ],
      [{ id: 'a1', category: 'x', description: 'conta' }],
    );
    expect(changed[0].category).toBe('Energia');
  });

  test('leaves an account unchanged when it already has the matched category', () => {
    const { changed, reclassified } = reclassifyAccounts(cats, [
      { id: 'a1', category: 'Água', description: 'água' },
    ]);
    expect(reclassified).toBe(0);
    expect(changed).toEqual([]);
  });

  test('leaves an account unchanged when nothing matches', () => {
    const { changed, reclassified } = reclassifyAccounts(cats, [
      { id: 'a1', category: 'Outros', description: 'padaria' },
    ]);
    expect(reclassified).toBe(0);
    expect(changed).toEqual([]);
  });

  test('ignores empty keywords and does not mutate the input', () => {
    const accounts = [{ id: 'a1', category: 'x', description: 'luz' }];
    reclassifyAccounts([{ name: 'Energia', keywords: ' , luz ,' }], accounts);
    expect(accounts[0].category).toBe('x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/api test reclassify`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/categories/domain/reclassify.ts
type Categorizable = { id: string; category: string; description: string };
type CategoryRule = { name: string; keywords: string };

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function reclassifyAccounts(
  categories: CategoryRule[],
  accounts: Categorizable[],
): { changed: Categorizable[]; reclassified: number } {
  const changed: Categorizable[] = [];
  for (const account of accounts) {
    const hay = norm(`${account.description} ${account.category}`);
    const hit = categories.find((category) =>
      norm(category.keywords)
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .some((keyword) => hay.includes(keyword)),
    );
    if (hit && hit.name !== account.category) {
      changed.push({ ...account, category: hit.name });
    }
  }
  return { changed, reclassified: changed.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/api test reclassify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/categories/domain/reclassify.ts apps/api/src/categories/domain/reclassify.test.ts
git commit -m "feat(api): pure reclassifyAccounts for keyword-based account categorization"
```

---

## Task 2: API — categories domain, repository, migration, pg adapter, contract

Mirror the `settings` feature's file layout. Read `apps/api/src/settings/domain/condo-settings.ts`, `settings/domain/settings-repository.ts`, `settings/domain/errors.ts`, `settings/adapters/postgres/settings-repository.ts`, and `settings/adapters/settings-repository.contract.ts` as templates.

**Files:** create the domain (`category.ts`, `errors.ts`, `category-repository.ts`), the migration entry, the pg adapter, and the contract (`category-repository.contract.ts` + `category-repository.pg.test.ts`).

- [ ] **Step 1: Domain — `category.ts`, `errors.ts`, `category-repository.ts`**

```ts
// apps/api/src/categories/domain/category.ts
import { z } from 'zod';

export const categorySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  keywords: z.string().max(400),
  position: z.number().int().min(0),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryDraftSchema = categorySchema.extend({
  id: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
});
export type CategoryDraft = z.infer<typeof categoryDraftSchema>;
```

```ts
// apps/api/src/categories/domain/errors.ts
export class CategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryValidationError';
  }
}
```

```ts
// apps/api/src/categories/domain/category-repository.ts
import type { Category } from './category';

export interface CategoryRepository {
  list(): Promise<Category[]>;
  replaceAll(categories: Category[]): Promise<Category[]>;
}
```

- [ ] **Step 2: Migration `007_categories`** — append to the array in `apps/api/src/platform/postgres/migrations.ts` (after `006_resident_status_override`):

```ts
  {
    id: '007_categories',
    sql: `
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT NOT NULL,
  position INTEGER NOT NULL
);

INSERT INTO categories (id, name, keywords, position) VALUES
  ('cat-agua', 'Água', 'água, agua, saneamento, esgoto', 0),
  ('cat-energia', 'Energia', 'energia, luz, elétr, eletr', 1),
  ('cat-servicos', 'Serviços', 'limpeza, internet, portaria, serviço, servico, segurança', 2),
  ('cat-manutencao', 'Manutenção', 'manutenção, manutencao, reparo, elevador, conserto, bomba', 3);
`,
  },
```

- [ ] **Step 3: pg adapter — `category-repository.ts`**

```ts
// apps/api/src/categories/adapters/postgres/category-repository.ts
import type { Pool } from 'pg';

import { categorySchema, type Category } from '../../domain/category';
import type { CategoryRepository } from '../../domain/category-repository';

interface CategoryRow {
  id: string;
  name: string;
  keywords: string;
  position: number;
}

export class PostgresCategoryRepository implements CategoryRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Category[]> {
    const { rows } = await this.pool.query<CategoryRow>(
      'SELECT id, name, keywords, position FROM categories ORDER BY position',
    );
    return rows.map((row) => categorySchema.parse(row));
  }

  async replaceAll(categories: Category[]): Promise<Category[]> {
    const parsed = categories.map((category, index) =>
      categorySchema.parse({ ...category, position: index }),
    );
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM categories');
      for (const category of parsed) {
        await client.query(
          'INSERT INTO categories (id, name, keywords, position) VALUES ($1, $2, $3, $4)',
          [category.id, category.name, category.keywords, category.position],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return parsed;
  }
}
```

- [ ] **Step 4: Contract — mirror `settings/adapters/settings-repository.contract.ts`**

Read that file for the exact shape (a `describe`-exporting function taking a factory, plus a `*.pg.test.ts` that runs it against the pg pool with a reset). Create:

- `apps/api/src/categories/adapters/category-repository.contract.ts` exporting `categoryRepositoryContract(makeRepo)` with tests: `list` returns seeded rows ordered by position; `replaceAll` replaces the whole set and returns them with re-indexed positions; `list` after `replaceAll` reflects the new set.
- `apps/api/src/categories/adapters/category-repository.pg.test.ts` that wires `new PostgresCategoryRepository(pool)` and runs the contract (mirror `settings`'s pg test, including the DB reset/`TRUNCATE categories` between cases).

- [ ] **Step 5: Run the pg contract + full api gate check for this slice**

Run: `make api-test-pg` (or the project's pg-test target) then `pnpm --filter @morada/api test categories`
Expected: PASS. (If the repo uses `jest.pg.config.cjs` for `*.pg.test.ts`, follow the existing settings pg-test invocation.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/categories apps/api/src/platform/postgres/migrations.ts
git commit -m "feat(api): categories domain, migration, and Postgres repository"
```

---

## Task 3: API — get/save use-cases, routes, composition

**Files:**

- Create: `apps/api/src/categories/app/get-categories.ts`, `save-categories.ts`, `save-categories.test.ts`, `apps/api/src/categories/adapters/http/routes.ts`.
- Modify: `apps/api/src/platform/repositories.ts`, `apps/api/src/compose.ts`.

**Interfaces:**

- Consumes: `reclassifyAccounts` (Task 1), `CategoryRepository` (Task 2).
- Produces: `saveCategories(repo, accounts, input)` where `accounts` is a local port `{ list(): Promise<Categorizable[]>; save(a: Categorizable): Promise<void> }`.

- [ ] **Step 1: Write the failing use-case test**

```ts
// apps/api/src/categories/app/save-categories.test.ts
import { CategoryValidationError } from '../domain/errors';
import { saveCategories, type AccountsForReclassify } from './save-categories';

function fakeRepo() {
  let stored: unknown[] = [];
  return {
    list: async () => stored as never,
    replaceAll: async (categories: never[]) => {
      stored = categories;
      return categories;
    },
  };
}

function fakeAccounts(
  initial: { id: string; category: string; description: string }[],
): AccountsForReclassify & { saved: { id: string; category: string }[] } {
  const saved: { id: string; category: string }[] = [];
  return {
    saved,
    list: async () => initial,
    save: async (a) => {
      saved.push({ id: a.id, category: a.category });
    },
  };
}

describe('saveCategories', () => {
  test('replaces categories and reclassifies matching accounts', async () => {
    const accounts = fakeAccounts([
      { id: 'a1', category: 'x', description: 'conta de luz' },
      { id: 'a2', category: 'y', description: 'padaria' },
    ]);
    const result = await saveCategories(fakeRepo(), accounts, [
      { name: 'Energia', keywords: 'luz' },
    ]);
    expect(result.reclassified).toBe(1);
    expect(accounts.saved).toEqual([{ id: 'a1', category: 'Energia' }]);
    expect(result.categories[0]).toMatchObject({ name: 'Energia', position: 0 });
    expect(result.categories[0].id).toMatch(/.+/);
  });

  test('rejects invalid input', async () => {
    await expect(saveCategories(fakeRepo(), fakeAccounts([]), [{ name: '' }])).rejects.toThrow(
      CategoryValidationError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/api test save-categories`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the use-cases**

```ts
// apps/api/src/categories/app/get-categories.ts
import type { Category } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';

export async function getCategories(repo: CategoryRepository): Promise<Category[]> {
  return repo.list();
}
```

```ts
// apps/api/src/categories/app/save-categories.ts
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { categoryDraftSchema, categorySchema, type Category } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';
import { CategoryValidationError } from '../domain/errors';
import { reclassifyAccounts } from '../domain/reclassify';

export type AccountsForReclassify = {
  list(): Promise<{ id: string; category: string; description: string }[]>;
  save(account: { id: string; category: string; description: string }): Promise<void>;
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
  const saved = await repo.replaceAll(categories);
  const current = await accounts.list();
  const { changed, reclassified } = reclassifyAccounts(saved, current);
  for (const account of changed) {
    await accounts.save(account);
  }
  return { categories: saved, reclassified };
}
```

- [ ] **Step 4: Routes**

```ts
// apps/api/src/categories/adapters/http/routes.ts
import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getCategories } from '../../app/get-categories';
import { saveCategories, type AccountsForReclassify } from '../../app/save-categories';
import type { CategoryRepository } from '../../domain/category-repository';

export function categoryRoutes(
  repo: CategoryRepository,
  accounts: AccountsForReclassify,
): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await getCategories(repo)));
  app.put('/', async (c) => c.json(await saveCategories(repo, accounts, await c.req.json())));
  return app;
}
```

- [ ] **Step 5: DI + composition**

In `platform/repositories.ts`: import `PostgresCategoryRepository` + `CategoryRepository` type; add `categories: CategoryRepository;` to the bundle type and `categories: new PostgresCategoryRepository(pool),` to the returned object (place next to `accounts`).

In `compose.ts`: destructure `categories` from `repos` (the line that lists `residents, accounts, receipts, ...`); mount after the accounts route, adapting the real account repo into the port:

```ts
api.route(
  '/categories',
  guarded(
    'admin',
    categoryRoutes(categories, {
      list: () => accounts.list(),
      save: async (account) => {
        const existing = await accounts.getById(account.id);
        if (existing) await accounts.save({ ...existing, category: account.category });
      },
    }),
  ),
);
```

Add `import { categoryRoutes } from './categories/adapters/http/routes';` at the top.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @morada/api test save-categories` (PASS), then `make api-check` (full gate, incl. the `CategoryValidationError` handling — ensure it maps to a 4xx like the other validation errors; check how `compose.ts`/the error middleware handles `*ValidationError` and mirror it for `CategoryValidationError` if the mapping is name-based).
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/categories apps/api/src/platform/repositories.ts apps/api/src/compose.ts
git commit -m "feat(api): categories get/save endpoints with account reclassification"
```

---

## Task 4: Web — categories feature (domain, data, hooks)

Mirror the web `settings` feature (`apps/web/src/features/settings/{domain,data,ui/use-settings.ts}`).

**Files:** create `features/categories/domain/{category.ts,category-repository.ts}`, `features/categories/data/{http-category-repository.ts,in-memory-category-repository.ts}`, `features/categories/ui/use-categories.ts`.

- [ ] **Step 1: Domain**

```ts
// apps/web/src/features/categories/domain/category.ts
import { z } from 'zod';

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  keywords: z.string(),
  position: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;

export type CategoryDraft = { id?: string; name: string; keywords: string };
```

```ts
// apps/web/src/features/categories/domain/category-repository.ts
import type { Category, CategoryDraft } from './category';

export interface CategoryRepository {
  list(): Promise<Category[]>;
  save(categories: CategoryDraft[]): Promise<{ categories: Category[]; reclassified: number }>;
}
```

- [ ] **Step 2: Data adapters** — mirror `settings/data/http-settings-repository.ts`:

```ts
// apps/web/src/features/categories/data/http-category-repository.ts
import { apiClient } from '@/shared/lib/api-client';
import { z } from 'zod';

import { categorySchema, type Category, type CategoryDraft } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';

const listSchema = z.array(categorySchema);
const saveSchema = z.object({ categories: listSchema, reclassified: z.number().int() });

export class HttpCategoryRepository implements CategoryRepository {
  async list(): Promise<Category[]> {
    return listSchema.parse(await apiClient.get('/api/categories'));
  }
  async save(
    categories: CategoryDraft[],
  ): Promise<{ categories: Category[]; reclassified: number }> {
    return saveSchema.parse(await apiClient.put('/api/categories', categories));
  }
}
```

> Confirm `apiClient.get/put`'s exact signature by reading `shared/lib/api-client.ts` (some return parsed JSON directly; adjust the calls to match — mirror how `http-settings-repository.ts` calls it).

Also create `in-memory-category-repository.ts` (for tests): holds a list, `save` stores the drafts (assigning ids/positions) and returns `{ categories, reclassified: 0 }` (the web repo doesn't reclassify; the API does — the in-memory fake just echoes).

- [ ] **Step 3: Hooks** — mirror `use-settings.ts`:

```ts
// apps/web/src/features/categories/ui/use-categories.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CategoryDraft } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';

export const categoriesQueryKey = ['categories'] as const;

export function useCategories(repository: CategoryRepository) {
  return useQuery({ queryKey: categoriesQueryKey, queryFn: () => repository.list() });
}

export function useSaveCategories(repository: CategoryRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categories: CategoryDraft[]) => repository.save(categories),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}
```

- [ ] **Step 4: Commit** (no test yet — exercised via the screen test in Task 5; this is plumbing)

```bash
git add apps/web/src/features/categories
git commit -m "feat(web): categories feature repository and hooks"
```

---

## Task 5: Web — Ajustes screen categories section

**Files:**

- Modify: `apps/web/src/features/settings/ui/settings-screen.tsx` (+ `settings-screen.test.tsx`)
- Modify: `apps/web/src/app/container.ts` (export `categoryRepository`), `apps/web/src/app/app.tsx` (pass it to `SettingsScreen`).

**Interfaces:**

- Consumes: `useCategories`/`useSaveCategories` (Task 4).

- [ ] **Step 1: Container + app wiring**

In `container.ts`: `import { HttpCategoryRepository } from '@/features/categories/data/http-category-repository';` and `export const categoryRepository = new HttpCategoryRepository();` (match how `settingsRepository` is constructed — pass `apiClient` if the settings one does).

In `app.tsx`: the `a-settings` case renders `<SettingsScreen repository={settingsRepository} categoryRepository={categoryRepository} onBack={() => go('a-home')} />`.

- [ ] **Step 2: Write the failing screen test** (append to `settings-screen.test.tsx`; read its top for the existing render + in-memory settings repo pattern)

```tsx
test('adds a category and shows the reclassified count after saving', async () => {
  const user = userEvent.setup();
  const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
  const categories = new InMemoryCategoryRepository([]);
  jest.spyOn(categories, 'save').mockResolvedValue({
    categories: [{ id: 'c1', name: 'Energia', keywords: 'luz', position: 0 }],
    reclassified: 2,
  });
  renderWithClient(
    <SettingsScreen repository={settings} categoryRepository={categories} onBack={jest.fn()} />,
  );

  await screen.findByText('Ajustes');
  await user.type(screen.getByLabelText('Nome da nova categoria'), 'Energia');
  await user.type(screen.getByLabelText('Palavras-chave da nova categoria'), 'luz, energia');
  await user.click(screen.getByRole('button', { name: /adicionar categoria/i }));
  await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

  expect(await screen.findByText(/2 contas foram reclassificadas/i)).toBeInTheDocument();
});
```

> Use the actual in-memory repo import paths (`InMemorySettingsRepository`, `InMemoryCategoryRepository`). If `InMemorySettingsRepository`'s constructor differs, match the existing settings test.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @morada/web test settings-screen`
Expected: FAIL — "Ajustes" title / category fields absent.

- [ ] **Step 4: Implement the screen changes**

In `settings-screen.tsx`:

- Change the header title text `Configurações` → `Ajustes`.
- Add `categoryRepository: CategoryRepository` to `Props`.
- Load categories with `useCategories(categoryRepository)`; keep local editable state seeded from `categories.data` (an array of `{ id?, name, keywords }`), plus a `newCat` `{ name, keywords }` and a `reclassifiedMsg` string.
- Render, under the existing Taxa fields, a "Categorias de contas" section (mirror the design lines 722-750): for each category an editable name input + keywords input + a remove button; a "Nova categoria" block with `aria-label="Nome da nova categoria"` + `aria-label="Palavras-chave da nova categoria"` + an "Adicionar categoria" button (appends to local state).
- Replace the primary button label with **"Salvar e reclassificar contas"**. Its handler: first save the fee (`useSaveSettings`, existing), then `useSaveCategories(...).mutateAsync(localCategories)`; on success set `reclassifiedMsg` to the design copy: `n > 0 ? (n === 1 ? 'Pronto — 1 conta foi reclassificada.' : \`Pronto — ${n} contas foram reclassificadas.\`) : 'Configurações salvas. Nenhuma conta precisou ser reclassificada.'`. Render `reclassifiedMsg` in a success box (role="status").

Keep the loading/error handling consistent with the existing screen (it may use the `StatusView` from sub-project 1 — reuse it if the file already imports it; otherwise keep the existing plain text).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @morada/web test settings-screen`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/settings/ui/settings-screen.tsx apps/web/src/features/settings/ui/settings-screen.test.tsx apps/web/src/app/container.ts apps/web/src/app/app.tsx
git commit -m "feat(web): Ajustes categories section with save-and-reclassify"
```

---

## Task 6: Web — gear in the admin header, drop the settings tab

**Files:**

- Modify: `apps/web/src/features/dashboard/ui/dashboard-screen.tsx` (+ test if present)
- Modify: `apps/web/src/app/app.tsx` (`adminNav`)

- [ ] **Step 1: Write the failing test** (in `dashboard-screen.test.tsx` if it exists; otherwise add one — read the file for the render pattern)

```tsx
test('the header gear navigates to settings', async () => {
  const user = userEvent.setup();
  const onOpenSettings = jest.fn();
  // render DashboardScreen with its required props + onOpenSettings (see Step 2)
  // ...
  await user.click(screen.getByRole('button', { name: /ajustes/i }));
  expect(onOpenSettings).toHaveBeenCalled();
});
```

> If `DashboardScreen` takes navigation via a prop, add `onOpenSettings?: () => void`; wire it from `app.tsx` (`onOpenSettings={() => go('a-settings')}`). Match the screen's existing prop style (it already has handlers for notices/messages icons — add the gear next to them).

- [ ] **Step 2: Implement**

- In `dashboard-screen.tsx`, add a gear icon button (`<Icon name="wrench" />`) in the header row beside the existing notice/messages icon buttons, `aria-label="Ajustes"`, `onClick={onOpenSettings}`. Add the `onOpenSettings?: () => void` prop.
- In `app.tsx`: pass `onOpenSettings={() => go('a-settings')}` where `DashboardScreen` is rendered. Remove the `settings` item object from `adminNav` (the `{ key: 'settings', label: 'Config.', icon: 'wrench', ... }` entry) so the admin bottom-nav becomes Início / Apartamentos / Contas / Sair.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @morada/web test dashboard-screen`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/dashboard/ui/dashboard-screen.tsx apps/web/src/app/app.tsx
git commit -m "feat(web): open Ajustes from a header gear, drop the settings bottom-nav tab"
```

---

## Task 7: Final gates

- [ ] **Step 1: API gate** — Run: `make api-check`. Expected: PASS (incl. the categories pg contract).
- [ ] **Step 2: Web gate** — Run: `make check`. Expected: PASS (≥ 80%).
- [ ] **Step 3:** If coverage dips, add focused tests for the uncovered branch (likely the settings-screen remove-category path or the empty-reclassified message). Commit any additions.

---

## Self-review notes

- **Spec coverage:** reclassify → T1; categories domain/migration/pg/contract → T2; use-cases/routes/wiring → T3; web feature → T4; Ajustes section → T5; gear + nav → T6; gates → T7.
- **Boundaries:** `save-categories` uses a local `AccountsForReclassify` port (no accounts/domain import), wired in `compose.ts` — same pattern as `create-receipt`'s `ResidentApartmentLookup`.
- **Type consistency:** `reclassifyAccounts(categories, accounts) → { changed, reclassified }`; `saveCategories → { categories, reclassified }`; the web `CategoryRepository.save → { categories, reclassified }` — all aligned.
- **Deliberate:** `condo_settings`/`settingsRoutes` unchanged; the fee and categories are saved by two calls behind one button. Account category stays free text.
