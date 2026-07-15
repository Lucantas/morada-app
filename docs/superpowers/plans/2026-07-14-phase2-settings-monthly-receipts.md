# Phase 2 — Condo settings, monthly receipts & receipt editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a configurable monthly condo fee, auto-ensure every active resident has the current month's "Taxa condominial" charge (lazily, on admin load), and let the admin edit an existing receipt or register one already paid with a back-dated payment date.

**Architecture:** Hono + Postgres API (hexagonal `domain/app/adapters/platform`) + Vite/React 19 web (feature-first `ui → domain ← data`, lint-enforced boundaries). New `settings` feature mirrors the existing `accounts` feature (single-table config). Monthly generation is a pure domain function driven by an admin-only endpoint the web calls on load. Receipt edit reuses the repository's `save` upsert.

**Tech Stack:** TypeScript strict, Zod, TanStack Query, Zustand, Jest (ts-jest api / Testing Library web), pnpm workspaces, lefthook gates, node-pg.

## Global Constraints

- TDD: a failing test precedes implementation, committed together.
- Coverage ≥ 80% (pre-push gate); domain near 100%.
- No `any`, no non-null assertions (`!`), no `console.*` — lint errors.
- Immutability: never mutate inputs; return new objects/arrays.
- Comments only when extremely necessary — no narration, no TODOs.
- Validate at boundaries with Zod; wrap infra errors in domain errors.
- `eslint-plugin-boundaries`: api domain is pure (only `zod` + `node:crypto`), app orchestrates domains, adapters implement ports; web `ui → domain ← data`, never another feature's `ui`. Never disable the rule.
- Conventional commits, small and atomic. Never `--no-verify`.
- Monetary values are integer cents (`monthly_fee_cents` / `monthlyFeeCents`, `value_cents` / `valueCents`).
- Payment methods are exactly `dinheiro` and `pix`.
- Condo-fee receipt title is exactly `Taxa condominial`; receipt `ref` is `MM/YYYY`.
- Migrations are append-only; the current last id is `003_payment_methods`, so the next is `004_condo_settings`. Never edit an existing migration.
- `residents.list()` returns only ACTIVE residents, each carrying `apartmentId` and `active`.

## Commands (reference)

- Web: full gate `make check` · tests `make test` · single `pnpm --filter @morada/web exec jest <path> -t "<name>"`
- API: full gate `make api-check` · tests `make db-up && make api-test` · single `pnpm --filter @morada/api exec jest <path> -t "<name>"`
- Format one file: `pnpm exec prettier --write <path>`
- The `settings`/`ensure-month` API changes require `make db-up` (migrations run on boot against the isolated `morada_test` db).

---

### Task 1: `condo_settings` migration + settings data layer (API)

A single-row config table with a `SettingsRepository`, mirroring the `accounts` feature module.

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `004_condo_settings`)
- Create: `apps/api/src/settings/domain/condo-settings.ts`
- Create: `apps/api/src/settings/domain/settings-repository.ts`
- Create: `apps/api/src/settings/domain/errors.ts`
- Create: `apps/api/src/settings/adapters/postgres/settings-repository.ts`
- Create: `apps/api/src/settings/adapters/settings-repository.contract.ts`
- Create: `apps/api/src/settings/adapters/settings-repository.pg.test.ts` (or whatever suffix the accounts contract test uses — see Step 5)
- Modify: `apps/api/src/platform/repositories.ts` (add `settings` to the bundle)

**Interfaces:**

- Produces: `condoSettingsSchema` → `CondoSettings = { monthlyFeeCents: number; dueDay: number }`; `interface SettingsRepository { get(): Promise<CondoSettings>; save(settings: CondoSettings): Promise<CondoSettings> }`; `PostgresSettingsRepository`. The migration seeds a single `default` row (`monthly_fee_cents = 15000`, `due_day = 15`), so `get()` always returns a value.

- [ ] **Step 1: Write the failing contract test**

First read `apps/api/src/accounts/adapters/account-repository.contract.ts` and the file that runs it against Postgres (find it: `grep -rn "runAccountRepositoryContract" apps/api/src`) to mirror exactly how a contract is wired into the suite. Then create `apps/api/src/settings/adapters/settings-repository.contract.ts`:

```ts
import type { SettingsRepository } from '../domain/settings-repository';

export function runSettingsRepositoryContract(
  label: string,
  makeRepo: () => Promise<SettingsRepository>,
): void {
  describe(label, () => {
    test('get returns the seeded default settings', async () => {
      const repo = await makeRepo();
      expect(await repo.get()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
    });

    test('save then get round-trips the updated settings', async () => {
      const repo = await makeRepo();
      await repo.save({ monthlyFeeCents: 20000, dueDay: 10 });
      expect(await repo.get()).toEqual({ monthlyFeeCents: 20000, dueDay: 10 });
    });

    test('save keeps a single row (upsert, not insert)', async () => {
      const repo = await makeRepo();
      await repo.save({ monthlyFeeCents: 18000, dueDay: 5 });
      await repo.save({ monthlyFeeCents: 19000, dueDay: 8 });
      expect(await repo.get()).toEqual({ monthlyFeeCents: 19000, dueDay: 8 });
    });
  });
}
```

Then create the pg test file mirroring the accounts one you found (same `makeRepo` pattern — truncate the table, `new PostgresSettingsRepository(pool)`; re-seed the default row if your reset truncates it, OR rely on migration seed if the pg reset re-runs migrations). Name/locate it exactly like the accounts contract test so the same jest config runs it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `make db-up && pnpm --filter @morada/api exec jest settings`
Expected: FAIL — modules `../domain/settings-repository` / `PostgresSettingsRepository` do not exist.

- [ ] **Step 3: Write the implementation**

`apps/api/src/settings/domain/condo-settings.ts`:

```ts
import { z } from 'zod';

export const condoSettingsSchema = z.object({
  monthlyFeeCents: z.number().int().min(0).max(1_000_000_000),
  dueDay: z.number().int().min(1).max(28),
});
export type CondoSettings = z.infer<typeof condoSettingsSchema>;
```

`apps/api/src/settings/domain/settings-repository.ts`:

```ts
import type { CondoSettings } from './condo-settings';

export interface SettingsRepository {
  get(): Promise<CondoSettings>;
  save(settings: CondoSettings): Promise<CondoSettings>;
}
```

`apps/api/src/settings/domain/errors.ts` — mirror `apps/api/src/accounts/domain/errors.ts` (read it first for the base class), e.g.:

```ts
import { DomainError } from '../../platform/domain-error';

export class SettingsValidationError extends DomainError {
  constructor(message: string) {
    super('SettingsValidationError', message, 400);
  }
}
```

(Use whatever base class + constructor shape `accounts/domain/errors.ts` uses — match it exactly; the import path above is a guess to be corrected against the real base.)

`apps/api/src/settings/adapters/postgres/settings-repository.ts`:

```ts
import type { Pool } from 'pg';

import { condoSettingsSchema, type CondoSettings } from '../../domain/condo-settings';
import type { SettingsRepository } from '../../domain/settings-repository';

const ROW_ID = 'default';

interface SettingsRow {
  monthly_fee_cents: number;
  due_day: number;
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly pool: Pool) {}

  async get(): Promise<CondoSettings> {
    const { rows } = await this.pool.query<SettingsRow>(
      'SELECT monthly_fee_cents, due_day FROM condo_settings WHERE id = $1',
      [ROW_ID],
    );
    const row = rows[0];
    return condoSettingsSchema.parse({
      monthlyFeeCents: row?.monthly_fee_cents ?? 15000,
      dueDay: row?.due_day ?? 15,
    });
  }

  async save(settings: CondoSettings): Promise<CondoSettings> {
    const parsed = condoSettingsSchema.parse(settings);
    await this.pool.query(
      `INSERT INTO condo_settings (id, monthly_fee_cents, due_day)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         monthly_fee_cents = EXCLUDED.monthly_fee_cents, due_day = EXCLUDED.due_day`,
      [ROW_ID, parsed.monthlyFeeCents, parsed.dueDay],
    );
    return parsed;
  }
}
```

Append to `apps/api/src/platform/postgres/migrations.ts` (after the `003_payment_methods` entry, inside the array):

```ts
  {
    id: '004_condo_settings',
    sql: `
CREATE TABLE condo_settings (
  id TEXT PRIMARY KEY,
  monthly_fee_cents INTEGER NOT NULL,
  due_day INTEGER NOT NULL DEFAULT 15
);

INSERT INTO condo_settings (id, monthly_fee_cents, due_day) VALUES ('default', 15000, 15);
`,
  },
```

In `apps/api/src/platform/repositories.ts`: import `PostgresSettingsRepository` + `SettingsRepository`, add `settings: SettingsRepository;` to the `Repositories` interface, and `settings: new PostgresSettingsRepository(pool),` to `makePostgresRepositories`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `make db-up && pnpm --filter @morada/api exec jest settings`
Expected: PASS (3 contract tests against Postgres).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/settings apps/api/src/platform/postgres/migrations.ts apps/api/src/platform/repositories.ts
git commit -m "feat(api): add condo_settings config table and repository"
```

---

### Task 2: Settings API endpoints (API)

`GET /api/settings` + `PUT /api/settings`, admin-only, mirroring the accounts app + routes.

**Files:**

- Create: `apps/api/src/settings/app/get-settings.ts`
- Create: `apps/api/src/settings/app/update-settings.ts`
- Create: `apps/api/src/settings/adapters/http/routes.ts`
- Create: `apps/api/src/settings/adapters/http/routes.test.ts`
- Modify: `apps/api/src/compose.ts` (mount the guarded settings routes)

**Interfaces:**

- Consumes: `SettingsRepository`, `condoSettingsSchema`, `SettingsValidationError` from Task 1.
- Produces: `getSettings(repo): Promise<CondoSettings>`; `updateSettings(repo, input): Promise<CondoSettings>`; `settingsRoutes(repo): Hono<ApiEnv>`. Mounted at `/api/settings` behind `requireRole('admin')`.

- [ ] **Step 1: Write the failing route test**

Read `apps/api/src/accounts/adapters/http/routes.test.ts` (find it) to mirror how routes are tested with an in-memory repo + the auth env. Create `apps/api/src/settings/adapters/http/routes.test.ts`:

```ts
import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { SettingsRepository } from '../../domain/settings-repository';
import type { CondoSettings } from '../../domain/condo-settings';
import { settingsRoutes } from './routes';

function makeRepo(initial: CondoSettings): SettingsRepository {
  let current = initial;
  return {
    get: async () => current,
    save: async (s) => {
      current = s;
      return s;
    },
  };
}

function mount(repo: SettingsRepository) {
  const app = new Hono<ApiEnv>();
  app.route('/settings', settingsRoutes(repo));
  return app;
}

describe('settings routes', () => {
  it('GET returns the current settings', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15 }));
    const res = await app.request('/settings');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
  });

  it('PUT updates and returns the new settings', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15 }));
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 10 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 20000, dueDay: 10 });
  });

  it('PUT rejects an invalid dueDay', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15 }));
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 31 }),
    });
    expect(res.status).toBe(400);
  });
});
```

(Adjust the invalid-input expectation to however the project's `onError` maps a Zod/domain validation failure — read `apps/api/src/platform/http-error.ts` and match; the accounts route test is your reference.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @morada/api exec jest settings/adapters/http`
Expected: FAIL — `./routes` does not exist.

- [ ] **Step 3: Write the implementation**

`apps/api/src/settings/app/get-settings.ts`:

```ts
import type { CondoSettings } from '../domain/condo-settings';
import type { SettingsRepository } from '../domain/settings-repository';

export async function getSettings(repo: SettingsRepository): Promise<CondoSettings> {
  return repo.get();
}
```

`apps/api/src/settings/app/update-settings.ts`:

```ts
import { condoSettingsSchema, type CondoSettings } from '../domain/condo-settings';
import { SettingsValidationError } from '../domain/errors';
import type { SettingsRepository } from '../domain/settings-repository';

export async function updateSettings(
  repo: SettingsRepository,
  input: unknown,
): Promise<CondoSettings> {
  const parsed = condoSettingsSchema.safeParse(input);
  if (!parsed.success) throw new SettingsValidationError('Configurações inválidas');
  return repo.save(parsed.data);
}
```

`apps/api/src/settings/adapters/http/routes.ts`:

```ts
import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getSettings } from '../../app/get-settings';
import { updateSettings } from '../../app/update-settings';
import type { SettingsRepository } from '../../domain/settings-repository';

export function settingsRoutes(repo: SettingsRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await getSettings(repo)));

  app.put('/', async (c) => c.json(await updateSettings(repo, await c.req.json())));

  return app;
}
```

In `apps/api/src/compose.ts`:

1. Add import: `import { settingsRoutes } from './settings/adapters/http/routes';`
2. Destructure `settings` from `repos`: change `const { residents, accounts, receipts, notices, threads, dashboard, users } = repos;` to include `settings`.
3. Mount it next to accounts (after the `api.route('/accounts', ...)` line): `api.route('/settings', guarded('admin', settingsRoutes(settings)));`

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morada/api exec jest settings`
Expected: PASS (contract + route tests).
Run: `pnpm --filter @morada/api exec jest src/compose` (or the app-level integration test if one exists) to confirm the mount didn't break composition.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/settings apps/api/src/compose.ts
git commit -m "feat(api): expose admin GET/PUT /api/settings for the condo fee"
```

---

### Task 3: Settings web screen (web)

An admin "Configurações" screen editing the monthly fee (with `MoneyInput`) and due day, wired into nav.

**Files:**

- Create: `apps/web/src/features/settings/domain/condo-settings.ts`
- Create: `apps/web/src/features/settings/domain/settings-repository.ts`
- Create: `apps/web/src/features/settings/data/http-settings-repository.ts`
- Create: `apps/web/src/features/settings/data/in-memory-settings-repository.ts`
- Create: `apps/web/src/features/settings/ui/settings-screen.tsx`
- Create: `apps/web/src/features/settings/ui/use-settings.ts`
- Create: `apps/web/src/features/settings/ui/settings-screen.test.tsx`
- Modify: `apps/web/src/app/nav-store.ts` (add `'a-settings'` to `View`)
- Modify: `apps/web/src/app/container.ts` (export `settingsRepository`)
- Modify: `apps/web/src/app/app.tsx` (AdminRouter case + admin nav entry — mirror `a-accounts`)

**Interfaces:**

- Consumes: `MoneyInput` (Phase 1). The web repo talks to `GET/PUT /api/settings`.
- Produces: `CondoSettings = { monthlyFeeCents: number; dueDay: number }` (web mirror); `SettingsRepository { get(): Promise<CondoSettings>; save(s): Promise<CondoSettings> }`; `SettingsScreen({ repository })`; nav view `'a-settings'`.

- [ ] **Step 1: Write the failing test**

Read `apps/web/src/features/accounts/data/http-account-repository.ts`, `.../in-memory-account-repository.ts`, and `apps/web/src/features/accounts/ui/use-accounts.ts` to mirror the data/hook patterns. Create `apps/web/src/features/settings/ui/settings-screen.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { InMemorySettingsRepository } from '../data/in-memory-settings-repository';
import { SettingsScreen } from './settings-screen';

function renderScreen(repo: InMemorySettingsRepository) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen repository={repo} onBack={() => {}} />
    </QueryClientProvider>,
  );
}

describe('SettingsScreen', () => {
  it('loads the current fee and saves an edited value as cents', async () => {
    const repo = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    renderScreen(repo);

    await waitFor(() => expect(screen.getByLabelText('Valor da taxa')).toHaveValue('150,00'));

    fireEvent.change(screen.getByLabelText('Valor da taxa'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(repo.snapshot()).toEqual({ monthlyFeeCents: 20000, dueDay: 15 }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/settings`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write the implementation**

`apps/web/src/features/settings/domain/condo-settings.ts`:

```ts
import { z } from 'zod';

export const condoSettingsSchema = z.object({
  monthlyFeeCents: z.number().int().min(0),
  dueDay: z.number().int().min(1).max(28),
});
export type CondoSettings = z.infer<typeof condoSettingsSchema>;
```

`apps/web/src/features/settings/domain/settings-repository.ts`:

```ts
import type { CondoSettings } from './condo-settings';

export interface SettingsRepository {
  get(): Promise<CondoSettings>;
  save(settings: CondoSettings): Promise<CondoSettings>;
}
```

`apps/web/src/features/settings/data/in-memory-settings-repository.ts`:

```ts
import { condoSettingsSchema, type CondoSettings } from '../domain/condo-settings';
import type { SettingsRepository } from '../domain/settings-repository';

export class InMemorySettingsRepository implements SettingsRepository {
  private current: CondoSettings;

  constructor(initial: CondoSettings) {
    this.current = condoSettingsSchema.parse(initial);
  }

  async get(): Promise<CondoSettings> {
    return this.current;
  }

  async save(settings: CondoSettings): Promise<CondoSettings> {
    this.current = condoSettingsSchema.parse(settings);
    return this.current;
  }

  snapshot(): CondoSettings {
    return this.current;
  }
}
```

`apps/web/src/features/settings/data/http-settings-repository.ts` — mirror `HttpAccountRepository` (read it): a class taking the api client, `get()` → `GET /api/settings` (parse with `condoSettingsSchema`), `save(s)` → `PUT /api/settings` with the body (parse response).

`apps/web/src/features/settings/ui/use-settings.ts` — mirror `use-accounts.ts`: a `settingsQueryKey`, `useSettings(repo)` (`useQuery`), and `useSaveSettings(repo)` (`useMutation` that invalidates `settingsQueryKey` on success).

`apps/web/src/features/settings/ui/settings-screen.tsx` — mirror `account-edit-screen.tsx`'s shell (petrol header + `ScreenBody`), using `MoneyInput` for the fee and a numeric `Field` for the due day:

```tsx
import { useEffect, useState } from 'react';

import { MoneyInput } from '@/shared/ui/money-input';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { SettingsRepository } from '../domain/settings-repository';
import { useSettings, useSaveSettings } from './use-settings';

type Props = { repository: SettingsRepository; onBack: () => void };

export function SettingsScreen({ repository, onBack }: Props) {
  const settings = useSettings(repository);
  const save = useSaveSettings(repository);
  const [feeCents, setFeeCents] = useState(0);
  const [dueDay, setDueDay] = useState('15');

  useEffect(() => {
    if (settings.data) {
      setFeeCents(settings.data.monthlyFeeCents);
      setDueDay(String(settings.data.dueDay));
    }
  }, [settings.data]);

  const submit = () => {
    const day = Number.parseInt(dueDay, 10);
    save.mutate(
      { monthlyFeeCents: feeCents, dueDay: Number.isFinite(day) ? day : 15 },
      { onSuccess: onBack },
    );
  };

  return (
    <Screen>
      <div
        style={{
          background: 'var(--petrol-800)',
          color: '#fff',
          padding: '18px 18px 20px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'rgba(255,255,255,.12)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            border: 'none',
            flex: 'none',
          }}
        >
          <Icon name="chevronLeft" color="#fff" />
        </button>
        <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600 }}>
          Configurações
        </div>
      </div>
      <ScreenBody>
        {settings.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando…</p>}
        {settings.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar as configurações.</p>
        )}
        {settings.isSuccess && (
          <div style={{ paddingTop: 2 }}>
            <MoneyInput label="Valor da taxa" value={feeCents} onChange={setFeeCents} />
            <Field label="Dia de vencimento" value={dueDay} onChange={setDueDay} type="number" />
            <PrimaryButton icon="check" onClick={submit}>
              Salvar
            </PrimaryButton>
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}
```

Wire the app:

- `apps/web/src/app/nav-store.ts`: add `| 'a-settings'` to the `View` union (after `'a-account-edit'`).
- `apps/web/src/app/container.ts`: add `import { HttpSettingsRepository } from '@/features/settings/data/http-settings-repository';` and `export const settingsRepository = new HttpSettingsRepository(apiClient);` next to the other repos.
- `apps/web/src/app/app.tsx`: read it, then mirror the `a-accounts` wiring — add a `case 'a-settings': return <SettingsScreen repository={settingsRepository} onBack={() => go('a-home')} />;` in the AdminRouter switch, and add a way to reach it (a nav/menu entry mirroring how `a-accounts` is reached, e.g. an admin nav item or a link on the admin home). Import `SettingsScreen` and `settingsRepository`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morada/web exec jest src/features/settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/settings apps/web/src/app/nav-store.ts apps/web/src/app/container.ts apps/web/src/app/app.tsx
git commit -m "feat(web): admin settings screen for the monthly condo fee"
```

---

### Task 4: `ensureMonthlyReceipts` pure domain function (API)

A pure function that, given the active residents, the existing receipts, the settings and today, returns the condo-fee receipt drafts that are missing for the current month.

**Files:**

- Create: `apps/api/src/receipts/domain/monthly-receipts.ts`
- Create: `apps/api/src/receipts/domain/monthly-receipts.test.ts`

**Interfaces:**

- Produces:
  - `CONDO_FEE_TITLE = 'Taxa condominial'`
  - `monthlyRef(today: string): string` → `MM/YYYY`
  - `monthlyDueDate(today: string, dueDay: number): string` → `YYYY-MM-DD` in the current month
  - `type MonthlyReceiptDraft = { residentId: string; apartmentId: string; ref: string; title: string; valueCents: number; dueDate: string; status: 'pendente' }`
  - `ensureMonthlyReceipts(input: { residents: { id: string; apartmentId: string }[]; receipts: { residentId?: string; ref: string; title: string }[]; settings: { monthlyFeeCents: number; dueDay: number }; today: string }): MonthlyReceiptDraft[]`

- [ ] **Step 1: Write the failing test**

`apps/api/src/receipts/domain/monthly-receipts.test.ts`:

```ts
import { ensureMonthlyReceipts, monthlyRef, monthlyDueDate } from './monthly-receipts';

const settings = { monthlyFeeCents: 15000, dueDay: 15 };
const TODAY = '2026-07-14';

describe('monthly receipt helpers', () => {
  it('formats the ref as MM/YYYY of today', () => {
    expect(monthlyRef(TODAY)).toBe('07/2026');
  });

  it('builds the due date in the current month with a padded day', () => {
    expect(monthlyDueDate(TODAY, 5)).toBe('2026-07-05');
    expect(monthlyDueDate(TODAY, 15)).toBe('2026-07-15');
  });
});

describe('ensureMonthlyReceipts', () => {
  const residents = [
    { id: 'r-1', apartmentId: 'apt-1' },
    { id: 'r-2', apartmentId: 'apt-2' },
  ];

  it('creates a draft for every active resident lacking this month’s condo fee', () => {
    const drafts = ensureMonthlyReceipts({ residents, receipts: [], settings, today: TODAY });
    expect(drafts).toEqual([
      {
        residentId: 'r-1',
        apartmentId: 'apt-1',
        ref: '07/2026',
        title: 'Taxa condominial',
        valueCents: 15000,
        dueDate: '2026-07-15',
        status: 'pendente',
      },
      {
        residentId: 'r-2',
        apartmentId: 'apt-2',
        ref: '07/2026',
        title: 'Taxa condominial',
        valueCents: 15000,
        dueDate: '2026-07-15',
        status: 'pendente',
      },
    ]);
  });

  it('skips residents who already have this month’s condo fee (idempotent)', () => {
    const receipts = [{ residentId: 'r-1', ref: '07/2026', title: 'Taxa condominial' }];
    const drafts = ensureMonthlyReceipts({ residents, receipts, settings, today: TODAY });
    expect(drafts.map((d) => d.residentId)).toEqual(['r-2']);
  });

  it('does not treat a different month or a different title as covering this month', () => {
    const receipts = [
      { residentId: 'r-1', ref: '06/2026', title: 'Taxa condominial' },
      { residentId: 'r-2', ref: '07/2026', title: 'Água' },
    ];
    const drafts = ensureMonthlyReceipts({ residents, receipts, settings, today: TODAY });
    expect(drafts.map((d) => d.residentId)).toEqual(['r-1', 'r-2']);
  });

  it('returns nothing when every active resident already has it', () => {
    const receipts = [
      { residentId: 'r-1', ref: '07/2026', title: 'Taxa condominial' },
      { residentId: 'r-2', ref: '07/2026', title: 'Taxa condominial' },
    ];
    expect(ensureMonthlyReceipts({ residents, receipts, settings, today: TODAY })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @morada/api exec jest src/receipts/domain/monthly-receipts.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

`apps/api/src/receipts/domain/monthly-receipts.ts`:

```ts
export const CONDO_FEE_TITLE = 'Taxa condominial';

export interface MonthlyReceiptDraft {
  residentId: string;
  apartmentId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
  status: 'pendente';
}

export function monthlyRef(today: string): string {
  const [year, month] = today.split('-');
  return `${month}/${year}`;
}

export function monthlyDueDate(today: string, dueDay: number): string {
  const [year, month] = today.split('-');
  return `${year}-${month}-${String(dueDay).padStart(2, '0')}`;
}

export function ensureMonthlyReceipts(input: {
  residents: { id: string; apartmentId: string }[];
  receipts: { residentId?: string; ref: string; title: string }[];
  settings: { monthlyFeeCents: number; dueDay: number };
  today: string;
}): MonthlyReceiptDraft[] {
  const ref = monthlyRef(input.today);
  const dueDate = monthlyDueDate(input.today, input.settings.dueDay);
  const covered = new Set(
    input.receipts
      .filter((r) => r.title === CONDO_FEE_TITLE && r.ref === ref && r.residentId !== undefined)
      .map((r) => r.residentId),
  );
  return input.residents
    .filter((r) => !covered.has(r.id))
    .map((r) => ({
      residentId: r.id,
      apartmentId: r.apartmentId,
      ref,
      title: CONDO_FEE_TITLE,
      valueCents: input.settings.monthlyFeeCents,
      dueDate,
      status: 'pendente' as const,
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @morada/api exec jest src/receipts/domain/monthly-receipts.test.ts`
Expected: PASS (6 assertions across the blocks).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts/domain/monthly-receipts.ts apps/api/src/receipts/domain/monthly-receipts.test.ts
git commit -m "feat(api): pure ensureMonthlyReceipts to compute missing monthly condo fees"
```

---

### Task 5: Monthly generation endpoint (API)

An admin-only `POST /api/receipts/ensure-month` that persists the missing drafts, idempotently.

**Files:**

- Create: `apps/api/src/receipts/app/generate-monthly-receipts.ts`
- Create: `apps/api/src/receipts/app/generate-monthly-receipts.test.ts`
- Modify: `apps/api/src/compose.ts` (register the endpoint before the `/receipts` mount)

**Interfaces:**

- Consumes: `ensureMonthlyReceipts` (Task 4); `ReceiptRepository` (`list`, `save`), `ResidentRepository` (`list` → active residents with `id`+`apartmentId`), `SettingsRepository` (`get`); `receiptSchema` for building the persisted receipt.
- Produces: `generateMonthlyReceipts(receipts, residents, settings, today): Promise<Receipt[]>` — creates and returns the newly-saved receipts (empty when all covered).

- [ ] **Step 1: Write the failing test**

`apps/api/src/receipts/app/generate-monthly-receipts.test.ts` (use in-memory fakes for the three repos):

```ts
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { generateMonthlyReceipts } from './generate-monthly-receipts';

function fakeReceipts(seed: Receipt[] = []): ReceiptRepository & { all: () => Receipt[] } {
  let rows = [...seed];
  return {
    list: async () => rows,
    listByResident: async (rid) => rows.filter((r) => r.residentId === rid),
    listByApartment: async (aid) => rows.filter((r) => r.apartmentId === aid),
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    save: async (r) => {
      rows = [...rows.filter((x) => x.id !== r.id), r];
      return r;
    },
    all: () => rows,
  };
}

const residents = {
  list: async () => [
    {
      id: 'r-1',
      apartmentId: 'apt-1',
      name: 'A',
      apt: 'Apto 1',
      phone: '',
      email: '',
      status: 'em_dia' as const,
      active: true,
    },
    {
      id: 'r-2',
      apartmentId: 'apt-2',
      name: 'B',
      apt: 'Apto 2',
      phone: '',
      email: '',
      status: 'em_dia' as const,
      active: true,
    },
  ],
} as unknown as Parameters<typeof generateMonthlyReceipts>[1];

const settings = { get: async () => ({ monthlyFeeCents: 15000, dueDay: 15 }) } as Parameters<
  typeof generateMonthlyReceipts
>[2];

const TODAY = '2026-07-14';

describe('generateMonthlyReceipts', () => {
  it('creates one pending condo-fee receipt per active resident, then is idempotent', async () => {
    const receipts = fakeReceipts();

    const first = await generateMonthlyReceipts(receipts, residents, settings, TODAY);
    expect(first).toHaveLength(2);
    expect(receipts.all()).toHaveLength(2);
    expect(
      first.every((r) => r.status === 'pendente' && r.ref === '07/2026' && r.valueCents === 15000),
    ).toBe(true);
    expect(first.map((r) => r.residentId).sort()).toEqual(['r-1', 'r-2']);

    const second = await generateMonthlyReceipts(receipts, residents, settings, TODAY);
    expect(second).toHaveLength(0);
    expect(receipts.all()).toHaveLength(2);
  });
});
```

(Match the `ResidentRepository`/`SettingsRepository` fake shapes to the real interfaces — read them; the casts above keep the test focused on the behavior under test.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @morada/api exec jest src/receipts/app/generate-monthly-receipts.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

`apps/api/src/receipts/app/generate-monthly-receipts.ts`:

```ts
import { randomUUID } from 'node:crypto';

import type { ResidentRepository } from '../../residents/domain/resident-repository';
import type { SettingsRepository } from '../../settings/domain/settings-repository';
import { ensureMonthlyReceipts } from '../domain/monthly-receipts';
import { receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function generateMonthlyReceipts(
  receipts: ReceiptRepository,
  residents: ResidentRepository,
  settings: SettingsRepository,
  today: string,
): Promise<Receipt[]> {
  const [activeResidents, existing, condoSettings] = await Promise.all([
    residents.list(),
    receipts.list(),
    settings.get(),
  ]);

  const drafts = ensureMonthlyReceipts({
    residents: activeResidents.map((r) => ({ id: r.id, apartmentId: r.apartmentId })),
    receipts: existing.map((r) => ({ residentId: r.residentId, ref: r.ref, title: r.title })),
    settings: condoSettings,
    today,
  });

  const created: Receipt[] = [];
  for (const draft of drafts) {
    const receipt = receiptSchema.parse({ ...draft, id: randomUUID() });
    created.push(await receipts.save(receipt));
  }
  return created;
}
```

In `apps/api/src/compose.ts`, register the endpoint **before** the `api.route('/receipts', receiptRoutes(receipts))` line (so the explicit path wins over the mounted group), e.g. right after the `POST /receipts` create handler:

```ts
import { generateMonthlyReceipts } from './receipts/app/generate-monthly-receipts';
```

```ts
api.post('/receipts/ensure-month', requireRole('admin'), async (c) =>
  c.json(
    await generateMonthlyReceipts(
      receipts,
      residents,
      settings,
      new Date().toISOString().slice(0, 10),
    ),
    201,
  ),
);
```

(`settings` is already destructured from `repos` in Task 2.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `make db-up && make api-test`
Expected: PASS (all api tests, incl. the new generation test).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts/app/generate-monthly-receipts.ts apps/api/src/receipts/app/generate-monthly-receipts.test.ts apps/api/src/compose.ts
git commit -m "feat(api): POST /receipts/ensure-month generates missing monthly condo fees"
```

---

### Task 6: Web trigger — ensure the month on admin load (web)

When the admin opens the app, call `ensure-month` once so every active resident has the current charge; then refresh the residents list.

**Files:**

- Modify: `apps/web/src/app/container.ts` (add `ensureMonthlyReceipts`)
- Modify: `apps/web/src/features/dashboard/ui/dashboard-screen.tsx` (fire once on mount, then invalidate residents)
- Test: `apps/web/src/features/dashboard/ui/dashboard-ensure-month.test.tsx`

**Interfaces:**

- Consumes: `apiClient.post('/api/receipts/ensure-month')` (Task 5).
- Produces: `container.ensureMonthlyReceipts(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/features/dashboard/ui/dashboard-ensure-month.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';

import { DashboardScreen } from './dashboard-screen';

jest.mock('./use-dashboard', () => ({
  useDashboard: () => ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: {
      balance: { balanceCents: 0, incomeCents: 0, paidCents: 0 },
      recentPaid: [],
      maintenances: [],
    },
  }),
}));

const ensureMock = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/container', () => ({ ensureMonthlyReceipts: () => ensureMock() }));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardScreen
        repository={{} as never}
        onSendNotice={() => {}}
        onOpenMessages={() => {}}
        onSeeAccounts={() => {}}
        unreadCount={0}
        bottomNav={null}
      />
    </QueryClientProvider>,
  );
}

describe('DashboardScreen monthly ensure', () => {
  it('calls ensure-month once on mount', async () => {
    ensureMock.mockClear();
    renderScreen();
    await waitFor(() => expect(ensureMock).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/dashboard/ui/dashboard-ensure-month.test.tsx`
Expected: FAIL — `ensureMonthlyReceipts` is not exported / not called.

- [ ] **Step 3: Write the implementation**

In `apps/web/src/app/container.ts`, add:

```ts
/** Admin-only: ensure every active resident has the current month's condo-fee
 *  charge. Idempotent; safe to call on each admin load. */
export async function ensureMonthlyReceipts(): Promise<void> {
  await apiClient.post('/api/receipts/ensure-month', {});
}
```

In `apps/web/src/features/dashboard/ui/dashboard-screen.tsx`, fire it once on mount and refresh the residents list afterwards. Add imports:

```tsx
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { ensureMonthlyReceipts } from '@/app/container';
import { residentsQueryKey } from '@/features/residents/ui/use-residents';
```

Inside `DashboardScreen`, after `const dashboard = useDashboard(repository);`:

```tsx
const queryClient = useQueryClient();
useEffect(() => {
  let cancelled = false;
  void ensureMonthlyReceipts().then(() => {
    if (!cancelled) void queryClient.invalidateQueries({ queryKey: residentsQueryKey });
  });
  return () => {
    cancelled = true;
  };
}, [queryClient]);
```

(Confirm the exported query key name in `apps/web/src/features/residents/ui/use-residents.ts`; use whatever it exports — `residentsQueryKey`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morada/web exec jest src/features/dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/container.ts apps/web/src/features/dashboard/ui/dashboard-screen.tsx apps/web/src/features/dashboard/ui/dashboard-ensure-month.test.tsx
git commit -m "feat(web): ensure the month's condo fees when the admin opens the app"
```

---

### Task 7: Edit a receipt + register one already paid (API)

`PUT /api/receipts/:id` (admin) edits `ref/title/valueCents/dueDate`; the create endpoint gains an optional `paidAt`+`method` to register a receipt already paid (back-dated).

**Files:**

- Create: `apps/api/src/receipts/app/edit-receipt.ts`
- Create: `apps/api/src/receipts/app/edit-receipt.test.ts`
- Modify: `apps/api/src/receipts/app/create-receipt.ts` (optional paid-on-create)
- Modify: `apps/api/src/receipts/app/create-receipt.test.ts` (find it; add a paid-on-create case)
- Modify: `apps/api/src/compose.ts` (register `PUT /receipts/:id` before the `/receipts` mount)

**Interfaces:**

- Consumes: `ReceiptRepository` (`getById`, `save`); `receiptSchema`, `isoDateSchema`, `receiptMethodSchema`; `ReceiptNotFoundError` (from `receipts/domain/errors`).
- Produces: `editReceipt(repo, id, input): Promise<Receipt>` — patches `ref/title/valueCents/dueDate`, preserves everything else; throws `ReceiptNotFoundError` if missing. `createReceipt` now accepts optional `paidAt` + `method`; when both are present the receipt is created `status: 'pago'`.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/receipts/app/edit-receipt.test.ts`:

```ts
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { ReceiptNotFoundError } from '../domain/errors';
import { editReceipt } from './edit-receipt';

function fakeRepo(seed: Receipt[]): ReceiptRepository {
  let rows = [...seed];
  return {
    list: async () => rows,
    listByResident: async (rid) => rows.filter((r) => r.residentId === rid),
    listByApartment: async (aid) => rows.filter((r) => r.apartmentId === aid),
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    save: async (r) => {
      rows = [...rows.filter((x) => x.id !== r.id), r];
      return r;
    },
  };
}

const paid: Receipt = {
  id: 'rc-1',
  ref: '07/2026',
  title: 'Taxa condominial',
  dueDate: '2026-07-15',
  paidAt: '2026-07-10',
  valueCents: 15000,
  status: 'pago',
  method: 'pix',
  residentId: 'r-1',
  apartmentId: 'apt-1',
};

describe('editReceipt', () => {
  it('updates only ref/title/valueCents/dueDate and preserves status/paidAt/method/ids', async () => {
    const repo = fakeRepo([paid]);
    const updated = await editReceipt(repo, 'rc-1', {
      ref: '07/2026',
      title: 'Taxa condominial',
      valueCents: 16000,
      dueDate: '2026-07-20',
    });
    expect(updated).toMatchObject({
      id: 'rc-1',
      valueCents: 16000,
      dueDate: '2026-07-20',
      status: 'pago',
      paidAt: '2026-07-10',
      method: 'pix',
      residentId: 'r-1',
      apartmentId: 'apt-1',
    });
  });

  it('throws ReceiptNotFoundError for a missing id', async () => {
    const repo = fakeRepo([]);
    await expect(
      editReceipt(repo, 'nope', { ref: 'x', title: 'y', valueCents: 1, dueDate: '2026-07-20' }),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });
});
```

Add to the create-receipt test (read `create-receipt.test.ts` first to reuse its lookup fake) a case:

```ts
it('registers a receipt already paid when paidAt and method are given', async () => {
  // reuse this file's existing repo + residentApartment fakes
  const receipt = await createReceipt(repo, lookup, {
    residentId: 'r-1',
    ref: '06/2026',
    title: 'Taxa condominial',
    valueCents: 15000,
    dueDate: '2026-06-15',
    paidAt: '2026-06-14',
    method: 'dinheiro',
  });
  expect(receipt).toMatchObject({ status: 'pago', paidAt: '2026-06-14', method: 'dinheiro' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @morada/api exec jest src/receipts/app/edit-receipt.test.ts src/receipts/app/create-receipt.test.ts`
Expected: FAIL — `edit-receipt` missing; create ignores `paidAt`/`method`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/receipts/app/edit-receipt.ts`:

```ts
import { z } from 'zod';

import { ReceiptNotFoundError, ReceiptValidationError } from '../domain/errors';
import { isoDateSchema, receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

const patchSchema = z.object({
  ref: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  dueDate: isoDateSchema,
});

export async function editReceipt(
  repo: ReceiptRepository,
  id: string,
  input: unknown,
): Promise<Receipt> {
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptValidationError('Dados do recibo inválidos');
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const updated = receiptSchema.parse({ ...existing, ...parsed.data });
  return repo.save(updated);
}
```

(Confirm `ReceiptNotFoundError`'s constructor signature in `receipts/domain/errors.ts` and match it.)

Extend `apps/api/src/receipts/app/create-receipt.ts` — add optional `paidAt`/`method` and derive status:

```ts
import { isoDateSchema, receiptMethodSchema, receiptSchema, type Receipt } from '../domain/receipt';
```

```ts
const inputSchema = z.object({
  residentId: z.string().min(1).max(64),
  ref: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  dueDate: isoDateSchema,
  paidAt: isoDateSchema.optional(),
  method: receiptMethodSchema.optional(),
});
```

Replace the receipt construction:

```ts
const paid = parsed.data.paidAt !== undefined && parsed.data.method !== undefined;
const { paidAt, method, ...base } = parsed.data;
const receipt = receiptSchema.parse({
  ...base,
  id: randomUUID(),
  apartmentId: apartment.apartmentId,
  status: paid ? 'pago' : 'pendente',
  ...(paid ? { paidAt, method } : {}),
});
return repo.save(receipt);
```

In `apps/api/src/compose.ts`, register the edit route before the `/receipts` mount (near the `POST /receipts` handler):

```ts
import { editReceipt } from './receipts/app/edit-receipt';
```

```ts
api.put('/receipts/:id', requireRole('admin'), async (c) =>
  c.json(await editReceipt(receipts, c.req.param('id'), await c.req.json())),
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make db-up && make api-test`
Expected: PASS (all api tests, incl. edit + paid-on-create).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts/app/edit-receipt.ts apps/api/src/receipts/app/edit-receipt.test.ts apps/api/src/receipts/app/create-receipt.ts apps/api/src/receipts/app/create-receipt.test.ts apps/api/src/compose.ts
git commit -m "feat(api): admin can edit a receipt and register one already paid"
```

---

### Task 8: Edit + "já pago" web UI (web)

An edit affordance in the apartment ledger, and a "já pago" toggle on the add-charge screen.

**Files:**

- Modify: `apps/web/src/app/container.ts` (add `editReceipt`; extend `issueCharge` with optional `paidAt`/`method`)
- Modify: `apps/web/src/features/residents/ui/issue-charge-screen.tsx` ("já pago" toggle)
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (edit affordance on a ledger receipt)
- Modify: `apps/web/src/features/residents/ui/issue-charge-screen.test.tsx` (paid-toggle case)
- Test: an edit test in the apartment-ledger test file (find the resident-edit-screen test, or add one)

**Interfaces:**

- Consumes: `PUT /api/receipts/:id` and the extended `POST /api/receipts` (Task 7); `MoneyInput`.
- Produces: `container.editReceipt(input: { receiptId; ref; title; valueCents; dueDate }): Promise<void>`; `container.issueCharge` accepts optional `paidAt` + `method`.

- [ ] **Step 1: Write the failing test**

Read `apps/web/src/features/residents/ui/issue-charge-screen.tsx` and its test first. Extend the issue-charge test with a paid-toggle case:

```tsx
it('sends paidAt and method when marked as already paid', async () => {
  const issue = jest.fn().mockResolvedValue(undefined);
  render(<IssueChargeScreen residentId="r-1" issue={issue} onBack={() => {}} />);

  fireEvent.change(screen.getByLabelText('Referência'), { target: { value: '06/2026' } });
  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '15000' } });
  fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-06-15' } });
  fireEvent.click(screen.getByLabelText('Já foi pago'));
  fireEvent.change(screen.getByLabelText('Data do pagamento'), { target: { value: '2026-06-14' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

  await waitFor(() =>
    expect(issue).toHaveBeenCalledWith(
      expect.objectContaining({ paidAt: '2026-06-14', method: 'dinheiro' }),
    ),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/residents/ui/issue-charge-screen.test.tsx`
Expected: FAIL — no "Já foi pago" control; `issue` payload lacks `paidAt`/`method`.

- [ ] **Step 3: Write the implementation**

`apps/web/src/app/container.ts`:

- Extend `issueCharge`'s input type with `paidAt?: string; method?: 'dinheiro' | 'pix'` (the POST body already forwards the whole `input`, so no body change is needed beyond the type).
- Add:

```ts
/** Admin-only: edit an existing receipt's ref/title/value/due date. */
export async function editReceipt(input: {
  receiptId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
}): Promise<void> {
  const { receiptId, ...patch } = input;
  await apiClient.put(`/api/receipts/${receiptId}`, patch);
}
```

(Confirm `apiClient` exposes `put`; if not, mirror how `post` is defined in `apps/web/src/shared/lib/api-client.ts` and add `put`.)

`issue-charge-screen.tsx`: the `issue` prop type gains optional `paidAt`/`method`. Add state `const [paid, setPaid] = useState(false); const [paidAt, setPaidAt] = useState(''); const [method, setMethod] = useState<'dinheiro' | 'pix'>('dinheiro');`. Render a checkbox labelled `Já foi pago` bound to `paid`; when `paid`, reveal a `Field label="Data do pagamento" type="date"` bound to `paidAt` and a method toggle (Dinheiro/Pix) mirroring the pay-screen buttons. In `submit`, include `...(paid && paidAt ? { paidAt, method } : {})` in the `issue({...})` payload.

`resident-edit-screen.tsx`: in the ledger row (`ReceiptLedgerRow`), add an "Editar" affordance that opens an inline edit form (ref/title/valueCents via `MoneyInput`/dueDate), and on submit calls a new `onEditReceipt({ receiptId, ref, title, valueCents, dueDate })` prop wired to `container.editReceipt`, then invalidates the apartment-receipts query. Mirror the existing "Dar baixa" inline-form pattern already in this file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test`
Expected: PASS (web suite, incl. the new paid-toggle + edit cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/container.ts apps/web/src/features/residents/ui/issue-charge-screen.tsx apps/web/src/features/residents/ui/resident-edit-screen.tsx apps/web/src/features/residents/ui/issue-charge-screen.test.tsx
git commit -m "feat(web): edit a receipt and register a charge already paid"
```

---

## Phase 2 done — final gate

- [ ] Run both full gates before the whole-branch review:

```bash
make check
make db-up && make api-check
```

Expected: both green, coverage ≥ 80%. This closes spec items 2 (register/edit receipts + back-dated paid), 5 (lazy monthly generation + configurable fee). Phase 3 (resident submits-payment + proof + admin confirm; status override) gets its own plan.

## Self-review notes

- **Spec coverage:** item 5 fee config → Tasks 1-3; item 5 lazy generation → Tasks 4-6; item 2 edit → Tasks 7-8; item 2 register-as-paid → Tasks 7 (create ext) + 8 (toggle). Back-dated "Dar baixa" already shipped pre-Phase-2 (resident-edit ledger + `payReceipt` paidAt) — not re-implemented.
- **Type consistency:** `CondoSettings = { monthlyFeeCents, dueDay }` identical api↔web; `SettingsRepository.get/save` consistent Tasks 1-3; `ensureMonthlyReceipts` input/`MonthlyReceiptDraft` shape (Task 4) matches `generateMonthlyReceipts`'s mapping (Task 5); `editReceipt(repo, id, input)` (Task 7) matches `container.editReceipt` payload (Task 8); `CONDO_FEE_TITLE = 'Taxa condominial'` used by generation and expected by the ledger.
- **No placeholders:** the few "read X and mirror" steps (settings error base class, api-client `put`, resident-edit ledger form, the accounts contract wiring) point at a concrete existing reference with the exact analog named — not vague "handle the rest".
- **Ordering:** Settings (1-3) precede generation (4-6) because generation reads the fee. Edit (7-8) is independent and last.
