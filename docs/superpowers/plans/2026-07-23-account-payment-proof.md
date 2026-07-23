# Comprovante de pagamento nas contas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin anexa um comprovante (PDF/imagem) a uma conta e o revisita; o morador baixa esse comprovante, quando existir, pela tela Condomínio.

**Architecture:** Espelha o padrão de comprovante já usado em `income` — write via `proofDataUrl` (data URL base64), read via flag `hasProof`, bytes servidos por `GET /api/accounts/:id/proof` a partir da porta `ProofStorage` (R2) com fallback base64. A rota de proof é montada fora do guard admin para o morador alcançá-la; o `PaidItem` do dashboard ganha `hasProof` para a tela do morador oferecer o download.

**Tech Stack:** Vite + React 19 (TS strict), Hono + Postgres (`pg`), Zod, Jest + Testing Library, pnpm.

## Global Constraints

- **Persistência:** apenas Postgres. Migrações são **append-only** em `apps/api/src/platform/postgres/migrations.ts` (próximo id: `014_account_proof`).
- **Sem libs novas.** Reusar `receipts/domain/proof.ts` (`proofSchema`), `receipts/domain/proof-storage.ts` (`ProofStorage`, `decodeDataUrl`, `ProofBytes`), e no web `features/receipts/domain/proof.ts` (`fileToDataUrl`, `isAllowedProof`).
- **Boundaries (lint):** `ui → domain ← data`; domínio puro (só `zod`). `accounts` pode importar `receipts/domain` (permitido); `resident-home/ui` pode importar `dashboard/domain` (já importa hoje). Nunca importar a `ui` de outra feature.
- **Não-negociáveis:** TDD (teste falho antes da implementação, mesmo commit); cobertura ≥ 80% (domínio ~100%); sem `any`, sem non-null assertion, sem `console.*`; imutabilidade; validar nos boundaries com Zod; conventional commits atômicos; **nunca** `--no-verify`.
- **Semântica de `proofDataUrl` (idêntica ao income):** `string` = novo upload; `null` = limpar; `undefined` = manter o comprovante existente.
- **Comandos de gate:** `make api-check` (api) e `make check` (web). Testes pg da API precisam do Postgres local — use `make api-test` (o Makefile sobe o db e exporta `DATABASE_URL`).

---

## Task 1: API — domínio Account ganha proof + interface `getProof`

**Files:**

- Modify: `apps/api/src/accounts/domain/account.ts`
- Modify: `apps/api/src/accounts/domain/account-repository.ts`
- Modify (stubs): `apps/api/src/accounts/app/list-accounts.test.ts`, `apps/api/src/accounts/app/save-account.test.ts`, `apps/api/src/accounts/app/archive-account.test.ts`
- Create (test): `apps/api/src/accounts/domain/account.test.ts`

**Interfaces:**

- Produces: `accountSchema` com `proofDataUrl?: string | null` e `hasProof?: boolean`; `AccountRepository.getProof(id: string): Promise<ProofBytes | null>`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/accounts/domain/account.test.ts`:

```ts
import { accountSchema } from './account';

describe('accountSchema — proof fields', () => {
  const base = {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
    valueCents: 5000,
    status: 'pago' as const,
  };

  test('accepts a data-URL proofDataUrl', () => {
    const parsed = accountSchema.parse({
      ...base,
      proofDataUrl: 'data:application/pdf;base64,JVBERi0=',
    });
    expect(parsed.proofDataUrl).toBe('data:application/pdf;base64,JVBERi0=');
  });

  test('accepts null (clear) and undefined (untouched) proofDataUrl', () => {
    expect(accountSchema.parse({ ...base, proofDataUrl: null }).proofDataUrl).toBeNull();
    expect(accountSchema.parse(base).proofDataUrl).toBeUndefined();
  });

  test('rejects a non-data-URL proofDataUrl', () => {
    expect(() => accountSchema.parse({ ...base, proofDataUrl: 'nope' })).toThrow();
  });

  test('carries hasProof through reads', () => {
    expect(accountSchema.parse({ ...base, hasProof: true }).hasProof).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/api test -- accounts/domain/account.test.ts`
Expected: FAIL — `proofDataUrl` accepted as unknown key / stripped (or `hasProof` missing).

- [ ] **Step 3: Add proof fields to the schema**

In `apps/api/src/accounts/domain/account.ts`, add the import and two fields:

```ts
import { z } from 'zod';

import { proofSchema } from '../../receipts/domain/proof';
import { isoDateSchema } from '../../shared/domain/iso-date';

export const accountStatusSchema = z.enum(['pago', 'pendente', 'atrasado']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const accountSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  // The date of the expense/lançamento. Nullable only for legacy rows.
  date: isoDateSchema.nullable(),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  status: accountStatusSchema,
  // string = new upload; null = clear; undefined = leave existing proof untouched.
  proofDataUrl: proofSchema.nullable().optional(),
  // Persistence-derived (whether a proof exists), never a write input.
  hasProof: z.boolean().optional(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = accountSchema.extend({
  id: z.string().min(1).optional(),
  date: isoDateSchema,
});
export type AccountDraft = z.infer<typeof accountDraftSchema>;
```

- [ ] **Step 4: Add `getProof` to the repository interface**

Replace `apps/api/src/accounts/domain/account-repository.ts` with:

```ts
import type { ProofBytes } from '../../receipts/domain/proof-storage';

import type { Account } from './account';

export interface AccountRepository {
  list(): Promise<Account[]>;
  getById(id: string): Promise<Account | null>;
  save(account: Account): Promise<Account>;
  archive(id: string): Promise<void>;
  getProof(id: string): Promise<ProofBytes | null>;
}
```

- [ ] **Step 5: Add `getProof` stubs to the three app-layer fake repos**

In each of `apps/api/src/accounts/app/list-accounts.test.ts`, `save-account.test.ts`, and `archive-account.test.ts`, the inline `fakeRepo` returns an object literal implementing `AccountRepository`. Add one line to each returned object so it satisfies the new interface:

```ts
    getProof: async () => null,
```

(Place it alongside the existing `list`/`getById`/`save`/`archive` members.)

- [ ] **Step 6: Run the account suites to verify green**

Run: `pnpm --filter @morada/api test -- accounts/`
Expected: PASS (new `account.test.ts` green; the three app-layer suites still green; no type errors from the interface change).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/accounts/domain/account.ts apps/api/src/accounts/domain/account-repository.ts apps/api/src/accounts/domain/account.test.ts apps/api/src/accounts/app/list-accounts.test.ts apps/api/src/accounts/app/save-account.test.ts apps/api/src/accounts/app/archive-account.test.ts
git commit -m "feat(accounts): add proof fields to the account domain and repository"
```

---

## Task 2: API — migração 014 + adapter Postgres com proof + wiring

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts`
- Modify: `apps/api/src/accounts/adapters/postgres/account-repository.ts`
- Modify: `apps/api/src/accounts/adapters/postgres/account-repository.test.ts`
- Modify: `apps/api/src/repositories.ts`

**Interfaces:**

- Consumes: `AccountRepository.getProof`, `accountSchema` (Task 1); `ProofStorage`, `decodeDataUrl`, `ProofBytes` from `receipts/domain/proof-storage`.
- Produces: `new PostgresAccountRepository(pool, storage: ProofStorage | null)` with proof offload/serve; DB columns `accounts.proof_data_url`, `accounts.proof_key`.

- [ ] **Step 1: Write the failing tests (proof offload/serve)**

Append to `apps/api/src/accounts/adapters/postgres/account-repository.test.ts`. First add a `FakeProofStorage` and import (mirror `income-repository.test.ts`), then the proof describe block:

```ts
import type { ProofBytes, ProofStorage } from '../../../receipts/domain/proof-storage';

class FakeProofStorage implements ProofStorage {
  private readonly store = new Map<string, string>();
  async put(key: string, dataUrl: string): Promise<void> {
    this.store.set(key, dataUrl);
  }
  async get(key: string): Promise<ProofBytes | null> {
    const dataUrl = this.store.get(key);
    if (!dataUrl) return null;
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    const contentType = match?.[1];
    const base64 = match?.[2];
    if (!contentType || !base64) return null;
    return { contentType, body: new Uint8Array(Buffer.from(base64, 'base64')) };
  }
  has(key: string): boolean {
    return this.store.has(key);
  }
}

describe('PostgresAccountRepository — proof offload/serve', () => {
  const BASE = {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
    valueCents: 5000,
    status: 'pago' as const,
  };
  const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('offloads a fresh data URL to storage, persisting proof_key (not base64) and hasProof', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);

    const saved = await repo.save({ ...BASE, proofDataUrl: DATA_URL });

    expect(saved.hasProof).toBe(true);
    expect(saved.proofDataUrl).toBeUndefined();
    expect(storage.has('accounts/a-1')).toBe(true);
    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM accounts WHERE id = $1',
      ['a-1'],
    );
    expect(rows[0].proof_key).toBe('accounts/a-1');
    expect(rows[0].proof_data_url).toBeNull();
  });

  test('falls back to inline base64 when storage is null, still hasProof: true', async () => {
    const repo = new PostgresAccountRepository(pool, null);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM accounts WHERE id = $1',
      ['a-1'],
    );
    expect(rows[0].proof_key).toBeNull();
    expect(rows[0].proof_data_url).toBe(DATA_URL);
    expect((await repo.getById('a-1'))?.hasProof).toBe(true);
  });

  test('getProof returns bytes from storage when proof_key is set', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const proof = await repo.getProof('a-1');
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof decodes legacy base64 when only proof_data_url is set', async () => {
    const repo = new PostgresAccountRepository(pool, null);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const proof = await repo.getProof('a-1');
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof returns null with no proof and for an unknown id', async () => {
    const repo = new PostgresAccountRepository(pool, null);
    await repo.save({ ...BASE, proofDataUrl: undefined });
    expect(await repo.getProof('a-1')).toBeNull();
    expect(await repo.getProof('nope')).toBeNull();
  });

  test('list carries hasProof, never proofDataUrl', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const [item] = await repo.list();
    expect(item?.hasProof).toBe(true);
    expect(item).not.toHaveProperty('proofDataUrl');
  });

  test('re-save with proofDataUrl undefined preserves; null clears', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });

    const kept = await repo.save({
      ...BASE,
      description: 'Água — abril (rev)',
      proofDataUrl: undefined,
    });
    expect(kept.hasProof).toBe(true);

    const cleared = await repo.save({ ...BASE, proofDataUrl: null });
    expect(cleared.hasProof).toBe(false);
    expect(await repo.getProof('a-1')).toBeNull();
  });
});
```

Also update the shared-contract constructor at the top of the same file:

```ts
runAccountRepositoryContract('PostgresAccountRepository', async () => {
  await resetPg(pool);
  return new PostgresAccountRepository(pool, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make api-test` (needs local Postgres; the Makefile handles `DATABASE_URL`)
Expected: FAIL — `PostgresAccountRepository` takes 1 arg / column `proof_key` does not exist.

- [ ] **Step 3: Add migration `014_account_proof`**

Append a new entry to the `MIGRATIONS` array in `apps/api/src/platform/postgres/migrations.ts` (after `013_proof_key`):

```ts
  {
    id: '014_account_proof',
    sql: `
ALTER TABLE accounts ADD COLUMN proof_data_url TEXT;
ALTER TABLE accounts ADD COLUMN proof_key TEXT;
`,
  },
```

- [ ] **Step 4: Rewrite the Postgres adapter with proof handling**

Replace `apps/api/src/accounts/adapters/postgres/account-repository.ts` with (mirrors `PostgresIncomeRepository`):

```ts
import type { Pool } from 'pg';

import {
  decodeDataUrl,
  type ProofBytes,
  type ProofStorage,
} from '../../../receipts/domain/proof-storage';
import { accountSchema, type Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

const DATA_URL_PATTERN = /^data:[^;]+;base64,/;

const INSERT_COLUMNS =
  'id, description, category, date, value_cents, status, proof_data_url, proof_key';
// DATE comes back as a YYYY-MM-DD string (::text). proof_* excluded from reads —
// reads only need whether a proof exists (has_proof); bytes are served via getProof.
const SELECT_COLUMNS =
  'id, description, category, date::text AS date, value_cents, status, (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof';

interface AccountRow {
  id: string;
  description: string;
  category: string;
  date: string | null;
  value_cents: number;
  status: string;
  has_proof: boolean;
}

interface ProofRow {
  proof_key: string | null;
  proof_data_url: string | null;
}

function toAccount(row: AccountRow): Account {
  return accountSchema.parse({
    id: row.id,
    description: row.description,
    category: row.category,
    date: row.date,
    valueCents: row.value_cents,
    status: row.status,
    hasProof: row.has_proof,
  });
}

export class PostgresAccountRepository implements AccountRepository {
  constructor(
    private readonly pool: Pool,
    private readonly storage: ProofStorage | null,
  ) {}

  async list(): Promise<Account[]> {
    const { rows } = await this.pool.query<AccountRow>(
      `SELECT ${SELECT_COLUMNS} FROM accounts WHERE visible = true`,
    );
    return rows.map(toAccount);
  }

  async getById(id: string): Promise<Account | null> {
    const { rows } = await this.pool.query<AccountRow>(
      `SELECT ${SELECT_COLUMNS} FROM accounts WHERE id = $1 AND visible = true`,
      [id],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async getProof(id: string): Promise<ProofBytes | null> {
    const { rows } = await this.pool.query<ProofRow>(
      'SELECT proof_key, proof_data_url FROM accounts WHERE id = $1 AND visible = true',
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.proof_key) return (await this.storage?.get(row.proof_key)) ?? null;
    if (row.proof_data_url) return decodeDataUrl(row.proof_data_url);
    return null;
  }

  async save(account: Account): Promise<Account> {
    const touchesProof = account.proofDataUrl !== undefined;
    const isFreshUpload =
      typeof account.proofDataUrl === 'string' && DATA_URL_PATTERN.test(account.proofDataUrl);
    let proofKey: string | null = null;
    let proofDataUrl: string | null = null;
    if (isFreshUpload && this.storage) {
      proofKey = `accounts/${account.id}`;
      await this.storage.put(proofKey, account.proofDataUrl as string);
    } else if (touchesProof) {
      proofDataUrl = account.proofDataUrl ?? null;
    }

    const proofSetClause = touchesProof
      ? ', proof_data_url = EXCLUDED.proof_data_url, proof_key = EXCLUDED.proof_key'
      : '';

    const result = await this.pool.query<{ has_proof: boolean }>(
      `INSERT INTO accounts (${INSERT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description, category = EXCLUDED.category,
         date = EXCLUDED.date, value_cents = EXCLUDED.value_cents,
         status = EXCLUDED.status${proofSetClause}
       RETURNING (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof`,
      [
        account.id,
        account.description,
        account.category,
        account.date,
        account.valueCents,
        account.status,
        proofDataUrl,
        proofKey,
      ],
    );

    return accountSchema.parse({
      ...account,
      proofDataUrl: undefined,
      hasProof: result.rows[0]?.has_proof ?? false,
    });
  }

  async archive(id: string): Promise<void> {
    await this.pool.query('UPDATE accounts SET visible = false WHERE id = $1', [id]);
  }
}
```

- [ ] **Step 5: Wire the storage into the composition root**

In `apps/api/src/repositories.ts`, update the accounts line in `makePostgresRepositories`:

```ts
    accounts: new PostgresAccountRepository(pool, proofStorage),
```

(`proofStorage` is already declared at the top of that function.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `make api-test`
Expected: PASS — proof offload/serve tests green; shared contract green; whole api suite green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/platform/postgres/migrations.ts apps/api/src/accounts/adapters/postgres/account-repository.ts apps/api/src/accounts/adapters/postgres/account-repository.test.ts apps/api/src/repositories.ts
git commit -m "feat(accounts): persist and serve account payment proofs (migration 014)"
```

---

## Task 3: API — rota de proof acessível ao morador

**Files:**

- Modify: `apps/api/src/accounts/adapters/http/routes.ts`
- Modify: `apps/api/src/compose.ts`
- Modify: `apps/api/src/compose.test.ts`

**Interfaces:**

- Consumes: `AccountRepository.getProof` (Task 2).
- Produces: `accountProofRoutes(repo: AccountRepository): Hono<ApiEnv>` exposing only `GET /:id/proof`; mounted at `/accounts` **before** the admin-guarded CRUD.

- [ ] **Step 1: Write the failing route test**

Append to `apps/api/src/compose.test.ts` (near the other proof route tests, inside the same top-level `describe`):

```ts
test('an account proof is downloadable by admin and by a resident; 404 without one', async () => {
  const admin = await withCreds(adminCredentials);
  const put = await admin.auth('/api/accounts/a-proof', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Energia — áreas comuns',
      category: 'Utilidades',
      date: '2026-05-10',
      valueCents: 8900,
      status: 'pago',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    }),
  });
  expect(put.status).toBe(200);

  const adminProof = await admin.auth('/api/accounts/a-proof/proof');
  expect(adminProof.status).toBe(200);
  expect(adminProof.headers.get('Content-Type')).toBe('image/png');

  const resident = await withCreds(residentCredentials);
  const residentProof = await resident.auth('/api/accounts/a-proof/proof');
  expect(residentProof.status).toBe(200);
  expect(residentProof.headers.get('Content-Type')).toBe('image/png');

  const noProof = await admin.auth('/api/accounts/a-plain', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Sem comprovante',
      category: 'Utilidades',
      date: '2026-05-11',
      valueCents: 5000,
      status: 'pago',
    }),
  });
  expect(noProof.status).toBe(200);
  expect((await admin.auth('/api/accounts/a-plain/proof')).status).toBe(404);
  expect((await admin.auth('/api/accounts/ghost/proof')).status).toBe(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `make api-test`
Expected: FAIL — resident gets 403 (proof still under the admin guard) / route not found.

- [ ] **Step 3: Add `accountProofRoutes` and keep the proof out of the admin CRUD**

Replace `apps/api/src/accounts/adapters/http/routes.ts` with:

```ts
import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { archiveAccount } from '../../app/archive-account';
import { getAccount } from '../../app/get-account';
import { listAccounts } from '../../app/list-accounts';
import { saveAccount } from '../../app/save-account';
import { accountDraftSchema } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

// Proof download is available to any authenticated user (admin or resident) —
// condo expense proofs are shared building information. Mounted OUTSIDE the admin
// guard; the CRUD below stays admin-only.
export function accountProofRoutes(repo: AccountRepository): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/:id/proof', async (c) => {
    const account = await repo.getById(c.req.param('id'));
    if (!account) return c.json({ error: 'Conta não encontrada' }, 404);
    const proof = await repo.getProof(account.id);
    if (!proof) return c.json({ error: 'Comprovante não encontrado' }, 404);
    return c.body(toArrayBufferView(proof.body), 200, { 'Content-Type': proof.contentType });
  });
  return app;
}

export function accountRoutes(repo: AccountRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await listAccounts(repo)));

  app.get('/:id', async (c) => c.json(await getAccount(repo, c.req.param('id'))));

  app.post('/', async (c) => {
    const draft = accountDraftSchema.parse(await c.req.json());
    // POST always creates: ignore any client-supplied id so it can't overwrite.
    return c.json(await saveAccount(repo, { ...draft, id: undefined }), 201);
  });

  app.put('/:id', async (c) => {
    const draft = accountDraftSchema.parse({ ...(await c.req.json()), id: c.req.param('id') });
    return c.json(await saveAccount(repo, draft));
  });

  app.delete('/:id', async (c) => {
    await archiveAccount(repo, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
```

- [ ] **Step 4: Mount the proof route before the guarded CRUD**

In `apps/api/src/compose.ts`: update the import and the mount.

Import line — add `accountProofRoutes`:

```ts
import { accountProofRoutes, accountRoutes } from './accounts/adapters/http/routes';
```

Replace the single accounts mount:

```ts
api.route('/accounts', accountProofRoutes(accounts));
api.route('/accounts', guarded('admin', accountRoutes(accounts)));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `make api-test`
Expected: PASS — admin and resident both download (200); 404 without proof / unknown id; CRUD still admin-only (existing admin-only account tests stay green).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/accounts/adapters/http/routes.ts apps/api/src/compose.ts apps/api/src/compose.test.ts
git commit -m "feat(accounts): serve account payment proof to any authenticated user"
```

---

## Task 4: API — `PaidItem.hasProof` no resumo do dashboard

**Files:**

- Modify: `apps/api/src/dashboard/domain/dashboard.ts`
- Modify: `apps/api/src/dashboard/domain/build-dashboard-summary.ts`
- Modify: `apps/api/src/dashboard/domain/build-dashboard-summary.test.ts`
- Modify: `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts`

**Interfaces:**

- Produces: `paidItemSchema` com `hasProof?: boolean`; `LedgerAccount.hasProof?: boolean` carregado no `recentPaid`.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/dashboard/domain/build-dashboard-summary.test.ts`:

```ts
describe('buildDashboardSummary — recentPaid carries hasProof', () => {
  test('reflects the LedgerAccount hasProof flag on paid items', () => {
    const summary = buildDashboardSummary(
      [
        {
          id: 'a-1',
          description: 'Água',
          category: 'Utilidades',
          date: '2026-04-05',
          valueCents: 5000,
          status: 'pago',
          hasProof: true,
        },
        {
          id: 'a-2',
          description: 'Energia',
          category: 'Utilidades',
          date: '2026-04-04',
          valueCents: 6000,
          status: 'pago',
        },
      ],
      [],
      [],
      '2026-04-20',
    );

    const byId = new Map(summary.recentPaid.map((p) => [p.id, p]));
    expect(byId.get('a-1')?.hasProof).toBe(true);
    expect(byId.get('a-2')?.hasProof).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/api test -- dashboard/domain/build-dashboard-summary.test.ts`
Expected: FAIL — `hasProof` is `undefined` on the paid items.

- [ ] **Step 3: Add `hasProof` to the schema**

In `apps/api/src/dashboard/domain/dashboard.ts`, extend `paidItemSchema`:

```ts
export const paidItemSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  dateLabel: z.string(),
  valueCents: z.number(),
  icon: dashIconSchema,
  hasProof: z.boolean().optional(),
});
```

- [ ] **Step 4: Carry `hasProof` through the summary builder**

In `apps/api/src/dashboard/domain/build-dashboard-summary.ts`, add the field to `LedgerAccount` and to the `recentPaid` map:

```ts
export interface LedgerAccount {
  id: string;
  description: string;
  category: string;
  date: string | null;
  valueCents: number;
  status: string;
  hasProof?: boolean;
}
```

```ts
const recentPaid = [...paidAccounts]
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  .slice(0, RECENT_PAID_LIMIT)
  .map((a) => ({
    id: a.id,
    label: a.description,
    dateLabel: a.date ? `Paga em ${formatBrDate(a.date)}` : 'Paga',
    valueCents: a.valueCents,
    icon: iconForAccount(a),
    hasProof: a.hasProof ?? false,
  }));
```

- [ ] **Step 5: Derive `has_proof` in the dashboard adapter**

In `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts`: add `has_proof` to the `AccountRow` interface, the SELECT, and the map.

```ts
interface AccountRow {
  id: string;
  description: string;
  category: string;
  date: string | null;
  value_cents: number;
  status: string;
  has_proof: boolean;
}
```

```ts
const accountsResult = await this.pool.query<AccountRow>(
  'SELECT id, description, category, date::text AS date, value_cents, status, (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof FROM accounts WHERE visible = true',
);
const accounts: LedgerAccount[] = accountsResult.rows.map((row) => ({
  id: row.id,
  description: row.description,
  category: row.category,
  date: row.date,
  valueCents: row.value_cents,
  status: row.status,
  hasProof: row.has_proof,
}));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `make api-test`
Expected: PASS — new dashboard test green; whole api suite green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/dashboard/domain/dashboard.ts apps/api/src/dashboard/domain/build-dashboard-summary.ts apps/api/src/dashboard/domain/build-dashboard-summary.test.ts apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts
git commit -m "feat(dashboard): flag paid accounts that have a downloadable proof"
```

- [ ] **Step 8: Run the full API gate**

Run: `make api-check`
Expected: PASS (typecheck + lint + tests + format).

---

## Task 5: Web — domínio de conta + repo in-memory com proof

**Files:**

- Modify: `apps/web/src/features/accounts/domain/account.ts`
- Modify: `apps/web/src/features/accounts/data/in-memory-account-repository.ts`
- Modify: `apps/web/src/features/accounts/data/in-memory-account-repository.test.ts`

**Interfaces:**

- Produces: web `accountSchema` com `proofDataUrl?: string | null` e `hasProof?: boolean`; `InMemoryAccountRepository.save` deriva `hasProof` a partir de `proofDataUrl`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/features/accounts/data/in-memory-account-repository.test.ts`:

```ts
import { buildAccount } from '@/test/factories.accounts';

import { InMemoryAccountRepository } from './in-memory-account-repository';

describe('InMemoryAccountRepository — proof', () => {
  test('save with a proofDataUrl reports hasProof and drops the raw data URL', async () => {
    const repo = new InMemoryAccountRepository([]);

    const saved = await repo.save(
      buildAccount({ id: 'p', proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }),
    );

    expect(saved.hasProof).toBe(true);
    expect(saved.proofDataUrl).toBeUndefined();
    expect((await repo.getById('p'))?.hasProof).toBe(true);
  });

  test('save with proofDataUrl null clears hasProof', async () => {
    const repo = new InMemoryAccountRepository([]);
    await repo.save(buildAccount({ id: 'p', proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }));

    const cleared = await repo.save(buildAccount({ id: 'p', proofDataUrl: null }));

    expect(cleared.hasProof).toBe(false);
  });
});
```

Note: `buildAccount` (in `apps/web/src/test/factories.accounts.ts`) builds a valid Account; passing `proofDataUrl` via overrides is accepted once the schema (Step 3) allows it. If `buildAccount`'s type does not accept `proofDataUrl`, widen its `overrides` param to `Partial<Account>` (the factory already spreads overrides onto the account).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- in-memory-account-repository`
Expected: FAIL — `hasProof` undefined / `proofDataUrl` still present.

- [ ] **Step 3: Mirror the proof fields on the web schema**

In `apps/web/src/features/accounts/domain/account.ts`, add the two fields to `accountSchema`:

```ts
export const accountSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  // The expense date as ISO (YYYY-MM-DD); null only for legacy rows.
  date: z.string().nullable(),
  valueCents: z.number().int().nonnegative(),
  status: accountStatusSchema,
  proofDataUrl: z.string().nullable().optional(),
  hasProof: z.boolean().optional(),
});
```

- [ ] **Step 4: Derive `hasProof` on save in the in-memory repo**

Replace the `save` method in `apps/web/src/features/accounts/data/in-memory-account-repository.ts`:

```ts
  async save(account: Account): Promise<Account> {
    const existing = this.accounts.get(account.id);
    const hasProof =
      account.proofDataUrl === undefined
        ? (existing?.hasProof ?? false)
        : account.proofDataUrl !== null;
    const stored: Account = { ...account, proofDataUrl: undefined, hasProof };
    this.accounts = new Map(this.accounts).set(stored.id, stored);
    return stored;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- in-memory-account-repository`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/accounts/domain/account.ts apps/web/src/features/accounts/data/in-memory-account-repository.ts apps/web/src/features/accounts/data/in-memory-account-repository.test.ts
git commit -m "feat(accounts): mirror proof fields on the web account domain and in-memory repo"
```

Note: if `buildAccount` needed widening, include `apps/web/src/test/factories.accounts.ts` in the commit.

---

## Task 6: Web — anexar/ver comprovante na edição da conta

**Files:**

- Modify: `apps/web/src/features/accounts/ui/account-edit-screen.tsx`
- Modify: `apps/web/src/features/accounts/ui/account-edit-screen.test.tsx`

**Interfaces:**

- Consumes: web `accountSchema` proof fields (Task 5); `fileToDataUrl`, `isAllowedProof` from `@/features/receipts/domain/proof`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/features/accounts/ui/account-edit-screen.test.tsx`:

```ts
  test('renders a proof link to the serving endpoint when the account has a proof', async () => {
    const repository = new InMemoryAccountRepository([
      buildAccount({ id: 'a-9', description: 'Energia', hasProof: true }),
    ]);
    renderWithClient(
      <AccountEditScreen repository={repository} accountId="a-9" onBack={jest.fn()} />,
    );

    expect(await screen.findByDisplayValue('Energia')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver comprovante/i })).toHaveAttribute(
      'href',
      '/api/accounts/a-9/proof',
    );
  });

  test('does not render a proof link when the account has no proof', async () => {
    const repository = new InMemoryAccountRepository([
      buildAccount({ id: 'a-9', description: 'Energia' }),
    ]);
    renderWithClient(
      <AccountEditScreen repository={repository} accountId="a-9" onBack={jest.fn()} />,
    );

    expect(await screen.findByDisplayValue('Energia')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ver comprovante/i })).not.toBeInTheDocument();
  });

  test('attaching a proof includes proofDataUrl in the saved account', async () => {
    const { repo, saved } = makeSpyRepo();
    renderWithClient(<AccountEditScreen repository={repo} onBack={() => {}} />);

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Energia' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Utilidades' } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '10/05/2026' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '8900' } });

    const file = new File(['x'], 'boleto.png', { type: 'image/png' });
    const input = screen.getByLabelText('Anexar comprovante') as HTMLInputElement;
    await userEvent.upload(input, file);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar conta' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect((saved[0] as { proofDataUrl?: string }).proofDataUrl).toMatch(/^data:image\/png;base64,/);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @morada/web test -- account-edit-screen.test`
Expected: FAIL — no "Anexar comprovante" input / no proof link.

- [ ] **Step 3: Add the proof block to the edit screen**

In `apps/web/src/features/accounts/ui/account-edit-screen.tsx`:

Add imports:

```ts
import { useEffect, useState, type ChangeEvent } from 'react';
```

```ts
import { fileToDataUrl, isAllowedProof } from '@/features/receipts/domain/proof';
```

Add `proofDataUrl` to `EMPTY`:

```ts
const EMPTY = {
  description: '',
  category: '',
  date: '',
  valueCents: 0,
  status: 'pendente' as AccountStatus,
  proofDataUrl: undefined as string | undefined,
};
```

Add proof state and handler inside the component (after the existing `useState` calls):

```ts
const [proofName, setProofName] = useState<string | null>(null);
const [proofError, setProofError] = useState<string | null>(null);

const handleProofChange = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  if (!isAllowedProof(dataUrl)) {
    setProofError('Envie uma imagem ou PDF do comprovante.');
    return;
  }
  setForm((prev) => ({ ...prev, proofDataUrl: dataUrl }));
  setProofName(file.name);
  setProofError(null);
};
```

The `useEffect` that prefills the form must not overwrite `proofDataUrl` — keep it `undefined` on load (only `hasProof` drives the "Ver comprovante" link). Update the prefill to preserve the rest of the form:

```ts
useEffect(() => {
  if (existing.data) {
    const { description, category, date, valueCents, status } = existing.data;
    setForm((prev) => ({ ...prev, description, category, date: date ?? '', valueCents, status }));
  }
}, [existing.data]);
```

Render the proof block just before the `{validationError && ...}` paragraph (after the Situação buttons `</div>`):

```tsx
<label
  htmlFor="account-proof"
  style={{
    display: 'block',
    fontWeight: 600,
    fontSize: '.9rem',
    marginBottom: 9,
    color: 'var(--ink-900)',
  }}
>
  Anexar comprovante
</label>;
{
  existing.data?.hasProof && (
    <a
      href={`/api/accounts/${accountId}/proof`}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        color: 'var(--petrol-700)',
        fontWeight: 600,
        fontSize: '.86rem',
        textDecoration: 'none',
      }}
    >
      <Icon name="receipt" size={15} />
      Ver comprovante
    </a>
  );
}
<input
  id="account-proof"
  type="file"
  accept="image/*,application/pdf"
  onChange={(event) => void handleProofChange(event)}
  style={{
    display: 'block',
    width: '100%',
    marginBottom: 8,
    fontFamily: "'Inter', sans-serif",
    fontSize: '.86rem',
  }}
/>;
{
  proofName && (
    <p style={{ color: 'var(--ink-500)', marginBottom: 12, fontSize: '.86rem' }}>{proofName}</p>
  );
}
{
  proofError && (
    <p style={{ color: 'var(--atraso-700)', marginBottom: 12, fontSize: '.88rem' }}>{proofError}</p>
  );
}
```

Include `proofDataUrl` in the saved payload — update `submit`:

```ts
save.mutate({ ...form, id: accountId, proofDataUrl: form.proofDataUrl }, { onSuccess: onBack });
```

Note: the `<input type="file">` is associated to its `<label>` via `htmlFor="account-proof"` / `id="account-proof"`, so `getByLabelText('Anexar comprovante')` resolves it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- account-edit-screen.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/accounts/ui/account-edit-screen.tsx apps/web/src/features/accounts/ui/account-edit-screen.test.tsx
git commit -m "feat(accounts): attach and view a payment proof on the account editor"
```

---

## Task 7: Web — download do comprovante pelo morador (Condomínio)

**Files:**

- Modify: `apps/web/src/features/dashboard/domain/dashboard.ts`
- Modify: `apps/web/src/features/resident-home/ui/resident-finance-screen.tsx`
- Modify: `apps/web/src/features/resident-home/ui/resident-finance-screen.test.tsx`

**Interfaces:**

- Consumes: web `PaidItem` shape.
- Produces: web `paidItemSchema` com `hasProof?: boolean`; link "Baixar comprovante" no `PaidRow` quando `item.hasProof`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/features/resident-home/ui/resident-finance-screen.test.tsx`:

```ts
import { buildDashboardSummary } from '@/test/factories.dashboard';

test('shows a download link only for a paid item that has a proof', async () => {
  const dashboardRepository = new InMemoryDashboardRepository(
    buildDashboardSummary({
      recentPaid: [
        {
          id: 'p-1',
          label: 'Conta de água — abril',
          dateLabel: 'Paga em 05/04',
          valueCents: 124_000,
          icon: 'water',
          hasProof: true,
        },
        {
          id: 'p-2',
          label: 'Energia — áreas comuns',
          dateLabel: 'Paga em 03/04',
          valueCents: 89_000,
          icon: 'bolt',
        },
      ],
    }),
  );
  renderWithClient(
    <ResidentFinanceScreen dashboardRepository={dashboardRepository} bottomNav={null} />,
  );

  const link = await screen.findByRole('link', { name: /baixar comprovante/i });
  expect(link).toHaveAttribute('href', '/api/accounts/p-1/proof');
  expect(screen.getAllByRole('link', { name: /baixar comprovante/i })).toHaveLength(1);
});
```

(The file already imports `InMemoryDashboardRepository`, `renderWithClient`, `screen`, and `ResidentFinanceScreen`; add only the `buildDashboardSummary` import if not already present — it is imported in the existing `setup`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- resident-finance-screen.test`
Expected: FAIL — no "Baixar comprovante" link (and `hasProof` stripped by the web schema).

- [ ] **Step 3: Mirror `hasProof` on the web PaidItem schema**

In `apps/web/src/features/dashboard/domain/dashboard.ts`, extend `paidItemSchema`:

```ts
export const paidItemSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  dateLabel: z.string(),
  valueCents: z.number(),
  icon: dashIconSchema,
  hasProof: z.boolean().optional(),
});
```

- [ ] **Step 4: Render the download link in `PaidRow`**

In `apps/web/src/features/resident-home/ui/resident-finance-screen.tsx`, replace the `PaidRow` function with a version that adds the link when `item.hasProof`:

```tsx
function PaidRow({ item }: { item: PaidItem }) {
  return (
    <SurfaceCard style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px' }}>
      <IconBadge icon={item.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.96rem' }}>{item.label}</div>
        <div style={{ fontSize: '.82rem', color: 'var(--ink-500)' }}>{item.dateLabel}</div>
        {item.hasProof && (
          <a
            href={`/api/accounts/${item.id}/proof`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 4,
              color: 'var(--petrol-700)',
              fontWeight: 600,
              fontSize: '.8rem',
              textDecoration: 'none',
            }}
          >
            Baixar comprovante
          </a>
        )}
      </div>
      <div className="fraunces" style={{ fontWeight: 600, color: 'var(--petrol-900)' }}>
        {'R$ ' + formatBRLShort(item.valueCents)}
      </div>
    </SurfaceCard>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- resident-finance-screen.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/dashboard/domain/dashboard.ts apps/web/src/features/resident-home/ui/resident-finance-screen.tsx apps/web/src/features/resident-home/ui/resident-finance-screen.test.tsx
git commit -m "feat(condo): let residents download an account's payment proof"
```

- [ ] **Step 7: Run the full web gate**

Run: `make check`
Expected: PASS (typecheck + lint + tests + format, coverage ≥ 80%).

---

## Final verification

- [ ] `make api-check` green
- [ ] `make check` green
- [ ] Whole-branch review (per CLAUDE.md #9) before merge to `main`.
