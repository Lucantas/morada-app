# Base multi-condomínio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every piece of operational data belongs to a `Condominium`, every API read/write is scoped to the condominium in the URL after a membership check, and the existing live data becomes the first condominium of a legacy organization — with the app behaving exactly as today from the user's point of view.

**Architecture:** One append-only migration adds `organizations`, `condominiums`, `organization_members`, `condo_roles` and a `condominium_id NOT NULL` on every operational table, backfilling all existing rows into a fixed legacy condominium. Postgres adapters take `condominiumId` in their **constructor** (a repository cannot exist unscoped), so the domain repository interfaces and use cases stay unchanged. Every operational route moves under `/api/condos/:condoId/…`; a platform middleware resolves the caller's access for that condo (→ per-condo `role` and `sub`) or answers 404. The web keeps writing `/api/...` paths; the API client rewrites them to the current condo's prefix.

**Tech Stack:** Hono, node-pg, Zod, Jest (API against `morada_test` Postgres); Vite + React 19, Zustand, TanStack Query, Jest + Testing Library (web); Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md` — this plan is **sub-project 1** (sections 5, 6, 10's `due_date`/thread-link prerequisites, 11.1, 12).

## Global Constraints

- Every commit touching `apps/api/src/<feature>/**` or `apps/web/src/features/<feature>/**` carries the trailer `Spec: docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md` (commit-msg hook rejects it otherwise). Never `--no-verify`.
- TDD: the failing test lands in the same commit as the implementation. Coverage gate 80% (pre-push). Run `make api-check` (API) / `make check` (web) before each commit — the pre-commit hook also runs prettier; a commit that silently aborts on format is a known trap: verify with `git log -1` after committing.
- No `any`, no `!` non-null assertions, no `console.*` (except the existing `onError`), no new comments beyond what is extremely necessary.
- Migrations are append-only in `apps/api/src/platform/postgres/migrations.ts`; never edit `001`–`014`.
- Nothing is hard-deleted; deactivation is a flag.
- Tests never touch the `morada` database — only `morada_test` (Makefile already does this).
- Layering (`docs/LAYERING.md`): `platform` imports only `platform`; a new feature needs the full layer set (`make new-feature app=api name=condos spec=<spec path>`).
- Domain vocabulary: `Organization`, `Condominium`, `OrgMember`, `CondoRole`. The login entity stays `User` (never `Account` — `Account` is an expense).
- Legacy ids, fixed: organization `org-legacy` (name `Condomínio Morada`), condominium `condo-legacy` (name `Condomínio Morada · Bloco 2`).
- Cross-condominium access is always **404**, never 403.
- UI is mobile-first; no visual redesign in this sub-project.

## Review Focus

1. **Upsert with a foreign id.** `PUT /api/condos/A/accounts/<id-of-an-account-in-B>` must 404 and leave B's row untouched — every `ON CONFLICT (id) DO UPDATE` must be guarded by `WHERE <table>.condominium_id = EXCLUDED.condominium_id` and treat 0 returned rows as not-found. Pinned by each contract's isolation test (Tasks 4–9).
2. **Moved-out resident keeps a session.** A morador whose occupancy is deactivated must get 401 on the next request and be unable to log in — today's `isResidentActive` behaviour must survive the move into the access resolver (Tasks 2–3).
3. **Migration on real data.** Backfill must leave row counts identical and every row in `condo-legacy`; `condo_settings` keeps its values; the real admin keeps logging in with the same password. Pinned by the migration test (Task 1) and the rehearsal on a production dump (Task 13).
4. **Proof download across condos.** `GET /api/condos/A/receipts/<B's receipt>/proof` → 404, even though the R2 key is guessable. Pinned in Task 5.
5. **Stale persisted web session after deploy.** A browser holding the old JWT shape or no persisted condo must land on login, not on a blank/erroring screen. Pinned in Task 10.

---

## File Structure

API — new:

- `apps/api/src/condos/{domain,app,adapters/postgres,adapters/http}/…` — `Condominium`, `CondoAccess`, `CondoRepository`, membership queries, `/me/condos` + `/api/condos/:condoId/info` routes.
- `apps/api/src/platform/condo-scope.ts` — `Scoped<T>`, `condoAccessMiddleware` factory.
- `apps/api/src/test-support/condos.ts` — `createTestCondo(pool, id)`.

API — modified: `platform/postgres/migrations.ts`, `platform/auth.ts`, `compose.ts`, `repositories.ts`, `seed-data.ts`, `test-fixtures.ts`, `test-support/pg.ts`, `compose.test.ts`, every `*/adapters/postgres/*-repository.ts` + its contract + test, every `*/adapters/http/routes.ts`, `users/app/create-resident-login.ts`, `users/adapters/http/auth-routes.ts`, `accounts/domain/account.ts`, `messages/domain/message.ts`.

Web — new: `apps/web/src/shared/lib/condo-scope.ts` (current condo store + path rewrite), `apps/web/src/features/condos/{domain,data,ui}` (condo info + rename).
Web — modified: `shared/lib/api-client.ts`, `app/container.ts`, `app/app.tsx`, `features/session/*`, every screen with the hardcoded `Bloco 2` / `Condomínio Morada`, the 4 proof `href`s, `features/settings/ui/settings-screen.tsx`, `features/accounts/{domain,data,ui}` (due date), `features/receipts/domain/receipt-proof.ts`, `apps/web/e2e/journey.spec.ts`.

Docs: `CLAUDE.md`, `docs/DATA-MODEL.md`, `docs/DEPLOY.md`.

---

### Task 1: Tenancy migration

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `015_tenancy`, `016_thread_links`, `017_account_due_date`)
- Modify: `apps/api/src/test-support/pg.ts` (`DATA_TABLES` += `notice_dismissals`, `condo_roles`, `organization_members`, `condominiums`, `organizations`)
- Create: `apps/api/src/test-support/condos.ts`
- Test: `apps/api/src/platform/postgres/migrations.test.ts` (new; runs against `morada_test`)

**Interfaces:**

- Produces (schema):
  - `organizations(id TEXT PK, name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  - `condominiums(id TEXT PK, organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  - `organization_members(id TEXT PK, organization_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('owner','member')), active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE (organization_id, user_id))`
  - `condo_roles(id TEXT PK, condominium_id TEXT NOT NULL REFERENCES condominiums(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('administrador','sindico','morador')), resident_id TEXT REFERENCES residents(id), active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE (condominium_id, user_id, role))`
  - `condominium_id TEXT NOT NULL REFERENCES condominiums(id)` + index on: `apartments, residents, accounts, receipts, notices, threads, categories, incomes, condo_settings`.
  - `apartments`: drop `UNIQUE(label)`; add `UNIQUE (condominium_id, label)`.
  - `condo_settings`: primary key becomes `condominium_id`; column `id` dropped.
  - `threads`: `resident_id TEXT`, `apartment_id TEXT` (nullable), backfilled.
  - `accounts`: `due_date DATE` (nullable).
- Produces (test helper): `createTestCondo(pool: Pool, id: string, opts?: { name?: string; orgId?: string }): Promise<void>` — inserts the org (if missing), the condo, and a `condo_settings` row (`monthly_fee_cents 15000, due_day 15`).

- [ ] **Step 1: Write the failing migration test.** In `migrations.test.ts`: drop and recreate the `public` schema of `morada_test`, apply migrations `001`–`014` only (export a `migrateTo(pool, lastId)` helper from `migrate.ts` if one doesn't exist, or apply the sliced array), insert a representative legacy dataset (one admin user `u-admin` role `admin`, one apartment, one resident + active occupancy, one resident user role `resident` with `resident_id`, one account, one receipt, one notice + dismissal, one thread whose `id` is the resident id, one income; `condo_settings` already has `default`), then apply the rest. Assertions:
  - `test('015 backfills every operational row into condo-legacy')` — for each of the 9 tables, `SELECT count(*) WHERE condominium_id = 'condo-legacy'` equals the pre-migration count, and `count(*) WHERE condominium_id IS NULL` is 0.
  - `test('015 keeps condo settings values under condo-legacy')` — `SELECT monthly_fee_cents, due_day FROM condo_settings WHERE condominium_id='condo-legacy'` = the pre-migration values.
  - `test('015 grants the legacy admin owner + administrador and residents morador')` — `organization_members` has (`org-legacy`,`u-admin`,`owner`); `condo_roles` has (`condo-legacy`,`u-admin`,`administrador`, `resident_id NULL`) and (`condo-legacy`, resident user, `morador`, its `resident_id`).
  - `test('apartment labels are unique per condominium, not globally')` — inserting `Apto 101` in `condo-legacy` and in a second condo succeeds; a second `Apto 101` in the same condo fails with unique violation.
  - `test('016 links threads to resident and apartment')` — the thread row has `resident_id` = its id and `apartment_id` = the resident's apartment.
  - `test('migrating an empty database still succeeds')` — fresh schema, all migrations, no error; `condo-legacy` exists with zero data rows.
- [ ] **Step 2: Run** `pnpm --filter @morada/api exec jest src/platform/postgres/migrations.test.ts` with `DATABASE_URL` = the test DB URL (`make api-test` exports it). Expected: FAIL (columns/tables missing).
- [ ] **Step 3: Write `015_tenancy`.** Order inside the migration: create `organizations`, `condominiums`; insert `org-legacy`/`condo-legacy`; for each of the 9 tables `ADD COLUMN condominium_id TEXT REFERENCES condominiums(id)`, `UPDATE … SET condominium_id = 'condo-legacy'`, `ALTER … SET NOT NULL`, `CREATE INDEX`; swap the apartments unique constraint (look up its real name with `\d apartments`, Postgres default is `apartments_label_key`); rebuild the `condo_settings` primary key; create `organization_members` and `condo_roles`; `INSERT … SELECT` the memberships from `users` (`role='admin'` → owner + administrador; `role='resident' AND resident_id IS NOT NULL` → morador) with `gen_random_uuid()::text` ids. Write `016_thread_links` (add + backfill from `apartment_residents`) and `017_account_due_date`.
- [ ] **Step 4: Implement `createTestCondo`** and extend `DATA_TABLES` (child tables before parents is irrelevant with `CASCADE`, but `organizations`/`condominiums` must be included so every test starts empty).
- [ ] **Step 5: Keep the suite green between tasks.** Each new `condominium_id` column in `015` gets `DEFAULT 'condo-legacy'`, so the not-yet-scoped adapters keep inserting. Task 9's migration `018_drop_legacy_defaults` removes those defaults once every adapter writes the column. Because `resetPg` truncates `condominiums`, it must re-insert `org-legacy`/`condo-legacy` after the truncate (otherwise the default violates the FK); Task 9 removes that re-insert. Run the migration test → PASS.
- [ ] **Step 6: Run** `make api-check` → PASS.
- [ ] **Step 7: Commit** `feat(platform): tenancy schema with legacy condominium backfill` (+ Spec trailer).

### Task 2: `condos` feature (API) — domain, repository, seed

**Files:**

- Create via `make new-feature app=api name=condos spec=docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md`, then fill:
  - `apps/api/src/condos/domain/condominium.ts`, `condo-access.ts`, `condo-repository.ts`, `errors.ts`
  - `apps/api/src/condos/adapters/postgres/condo-repository.ts` (+ `.test.ts`), `apps/api/src/condos/adapters/condo-repository.contract.ts`
- Modify: `apps/api/src/repositories.ts` (add `condos`), `apps/api/src/seed-data.ts`, `apps/api/src/test-fixtures.ts`

**Interfaces:**

- Produces:
  ```ts
  // condominium.ts
  export const condominiumSchema = z.object({
    id: z.string().min(1).max(64),
    organizationId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(80),
    active: z.boolean(),
  });
  export type Condominium = z.infer<typeof condominiumSchema>;
  export const condoRoleNameSchema = z.enum(['administrador', 'sindico', 'morador']);
  // condo-access.ts
  export type CondoAccess = {
    condominiumId: string;
    name: string;
    role: 'administrador' | 'sindico' | 'morador';
    residentId: string | null;
  };
  // condo-repository.ts
  export interface CondoRepository {
    listForUser(userId: string): Promise<CondoAccess[]>; // active condos the user can enter, one entry per condo (highest role wins: administrador > sindico > morador); org owners get every active condo of their org as 'administrador'
    accessFor(userId: string, condominiumId: string): Promise<CondoAccess | null>;
    getById(condominiumId: string): Promise<Condominium | null>;
    rename(condominiumId: string, name: string): Promise<Condominium>;
    create(input: {
      organizationId: string;
      name: string;
      monthlyFeeCents: number;
      dueDay: number;
    }): Promise<Condominium>; // also inserts condo_settings + the 4 default categories (uuid ids, same names/keywords/positions as migration 007)
    createOrganization(input: { name: string; ownerUserId: string }): Promise<{ id: string }>;
    grant(input: {
      condominiumId: string;
      userId: string;
      role: 'administrador' | 'sindico' | 'morador';
      residentId: string | null;
    }): Promise<void>; // idempotent (ON CONFLICT DO UPDATE SET active = TRUE, resident_id = EXCLUDED.resident_id)
  }
  ```
- `accessFor` rules (the single source of truth for "can this user enter this condo"): condo must be `active`; then (a) active `organization_members` owner of the condo's org → `administrador`; else (b) an active `condo_roles` row — for `morador`, only if its `resident_id` has an **active** occupancy (moved-out ⇒ `null`). Highest role wins.
- Seed: `seedAdmin(users, condos, hasher)` — after ensuring `u-admin`, if `condos.listForUser('u-admin')` is empty, create organization `Morada Demo` (owner `u-admin`), condominium `Condomínio Demo` (fee 15000, due day 15), grant `administrador`. Production guard unchanged.
- `seedFixtures(pool)` (test fixtures) inserts every fixture row with `condominium_id = 'condo-test'` after `createTestCondo(pool, 'condo-test')`, and grants the fixture admin `administrador` and the fixture resident user `morador` there. Export `TEST_CONDO_ID = 'condo-test'`.

- [ ] **Step 1: Write the contract** `runCondoRepositoryContract(label, makeRepo)` with tests:
  - `create inserts settings and default categories for the new condo` (query the tables: one `condo_settings` row with the given fee/day; 4 categories named Água, Energia, Serviços, Manutenção).
  - `listForUser returns only condos with an active role`; `org owner sees every active condo of the org as administrador`; `inactive condo is never listed nor accessible`.
  - `accessFor returns null for a condo the user has no role in`.
  - `accessFor returns null for a morador whose occupancy was deactivated` (insert resident + occupancy, grant morador, set occupancy inactive).
  - `highest role wins when a user is sindico and morador`.
  - `grant is idempotent and reactivates`.
  - `rename changes the name; rename of an unknown condo throws CondoNotFoundError` (status 404).
- [ ] **Step 2: Run** `pnpm --filter @morada/api exec jest src/condos` → FAIL.
- [ ] **Step 3: Implement** domain files, `CondoNotFoundError` (`status = 404`, message `Condomínio não encontrado`), `PostgresCondoRepository(pool)`.
- [ ] **Step 4: Update `seedAdmin`, `seedFixtures`, `repositories.ts`** (`condos: CondoRepository` in `Repositories`) and `compose.ts`'s seed call. Add `seed-data.test.ts` case: `seeds a demo condominium the admin administers when the admin has none`.
- [ ] **Step 5: Run** `make api-check` → PASS.
- [ ] **Step 6: Commit** `feat(condos): condominium, membership and access repository`.

### Task 3: Per-condo access in the platform + auth

**Files:**

- Create: `apps/api/src/platform/condo-scope.ts` (+ `condo-scope.test.ts`)
- Modify: `apps/api/src/platform/auth.ts`, `apps/api/src/users/adapters/http/auth-routes.ts`, `apps/api/src/condos/adapters/http/routes.ts` (new `meRoutes`), `apps/api/src/compose.ts`, `apps/api/src/compose.test.ts`

**Interfaces:**

- Consumes: `CondoRepository.listForUser`, `accessFor` (Task 2).
- Produces:
  ```ts
  // auth.ts
  export type Role = 'admin' | 'resident';
  export type ApiEnv = { Variables: { uid: string; role: Role; sub: string; condoId: string } };
  export async function signSession(userId: string): Promise<string>; // payload { uid, iat, exp }
  export const authMiddleware: MiddlewareHandler<ApiEnv>; // sets only 'uid'; payload without string uid ⇒ 401 'Sessão inválida'
  // condo-scope.ts
  export type Scoped<T> = (condoId: string) => T;
  export type ResolvedAccess = { role: Role; sub: string };
  export function condoAccessMiddleware(
    resolve: (userId: string, condoId: string) => Promise<ResolvedAccess | null>,
  ): MiddlewareHandler<ApiEnv>;
  // reads c.req.param('condoId'); null ⇒ 404 { error: 'Condomínio não encontrado' }; else sets condoId, role, sub
  ```
- Mapping done in `compose.ts` (platform can't import `condos`): `administrador`/`sindico`… → for this sub-project `administrador` ⇒ `{ role: 'admin', sub: userId }`; `morador` ⇒ `{ role: 'resident', sub: residentId }`; `sindico` ⇒ treated as **no access** (null) until sub-project 3.
- Routes: `POST /auth/login` → body `{ condos: CondoSummary[] }` where `CondoSummary = { id: string; name: string; role: Role }`; a user with zero accessible condos ⇒ `InvalidCredentialsError` (covers moved-out residents). `GET /me/condos` (auth required, outside `/api`) → `CondoSummary[]`.
- Mount: `app.route('/api/condos/:condoId', condoApi)` where `condoApi` has `authMiddleware`, `csrfMiddleware`, `condoAccessMiddleware(...)`, then **all existing feature routes unchanged** (still using the global repos — scoping comes in Tasks 4–9). Remove the old `/api` mount and the inline resident-active middleware (now inside `accessFor`).

- [ ] **Step 1: Write failing tests.** `condo-scope.test.ts`: `answers 404 when the resolver returns null`, `sets condoId, role and sub for downstream handlers`. In `compose.test.ts`: introduce `const P = \`/api/condos/${TEST_CONDO_ID}\`` and rewrite every `/api/…` path to `${P}/…`; add:
  - `login returns the condos the user can enter` (admin → `[{ id: 'condo-test', name: …, role: 'admin' }]`).
  - `GET /me/condos lists the caller's condos`.
  - `a condo the caller has no role in answers 404` (create `condo-other` with `createTestCondo`; `GET /api/condos/condo-other/residents` as admin → 404).
  - `a moved-out resident is refused at login and their open session gets 404` (keep today's equivalent tests, adapt the status where the route is now behind access: login → 401, next request → 404).
  - `a token without uid is rejected with 401`.
- [ ] **Step 2: Run** `make api-test` → FAIL.
- [ ] **Step 3: Implement** auth, middleware, `meRoutes(condos)`, login response, compose mount. CORS unchanged (no new header).
- [ ] **Step 4: Run** `make api-check` → PASS.
- [ ] **Step 5: Commit** `feat(platform): resolve per-condominium access on every api request`.

### Tasks 4–9: Scope each feature's repository and routes

All six tasks follow the same shape; each is its own commit and its own review.

**Shared pattern (every task):**

- Adapter constructor becomes `new PostgresXRepository(pool, condominiumId, …existingArgs)`; every `SELECT/UPDATE/DELETE` adds `AND condominium_id = $n`; every `INSERT` writes `condominium_id`; every `ON CONFLICT (id) DO UPDATE` adds `WHERE <table>.condominium_id = EXCLUDED.condominium_id` and, when the statement returns no row, throws the feature's existing `…NotFoundError` (status 404).
- Contract signature becomes `runXRepositoryContract(label: string, makeRepo: (condominiumId: string) => Promise<XRepository>)`; the pg test's factory calls `resetPg`, `createTestCondo(pool, 'condo-a')`, `createTestCondo(pool, 'condo-b')` once per test and returns a repo for the requested id. Every existing contract test uses `'condo-a'`.
- **Isolation test added to every contract**, named `isolation: condo B never sees or changes condo A's data`: save an entity in A; in B assert `list()` excludes it, `getById(id)` is `null`, `save({...entity, <some field changed>})` rejects with the NotFound error, and A's row is unchanged afterwards; for repos with `archive/remove/dismiss/getProof`, B's call is a no-op/`null` and A's row is unchanged.
- Route factories take `Scoped<Deps>` instead of `Deps`: `export function residentRoutes(scope: Scoped<ResidentRoutesDeps>, hasher: PasswordHasher)`; each handler starts with `const { residents, receipts } = scope(c.get('condoId'));`.
- `repositories.ts`: `makePostgresRepositories(pool)` returns `{ forCondo(condominiumId: string): CondoRepositories; users; condos }` where `CondoRepositories` is today's `Repositories` minus `users`/`condos`. Introduce `forCondo` in Task 4 with only `residents` scoped and the not-yet-migrated repos built with the legacy unscoped constructors; each later task moves its repo into `forCondo`.
- `compose.test.ts`: add one HTTP isolation test per task: `cross-condo <feature> access answers 404` (seed a row in `condo-other` via its scoped repo, request it through `/api/condos/condo-test/...` → 404; the list endpoint doesn't include it).

**Task 4 — residents + apartments** (`residents/adapters/postgres/resident-repository.ts`, `residents/adapters/http/{routes,apartment-routes}.ts`). `apartmentIdForLabel` looks up `(condominium_id, label)`. `residents.condominium_id` and `apartments.condominium_id` both written. `listByApartment(<B's apartment>)` from A → `[]`.

**Task 5 — receipts** (`receipts/adapters/postgres/receipt-repository.ts`, `receipts/adapters/http/{routes,apartment-routes}.ts`, `receipts/app/generate-monthly-receipts.ts` callers). New proof keys: `condos/${condominiumId}/receipts/${id}` (legacy `receipts/<id>` keys keep working because `getProof` reads the stored key from a condo-scoped row). Isolation test includes `getProof(<A's id>)` from B → `null`, and compose test `receipt proof of another condo answers 404`.

**Task 6 — accounts + income + due date** (`accounts/…`, `income/…`). Proof keys `condos/${id}/accounts/…`, `condos/${id}/incomes/…`. Add `dueDate: isoDateSchema.nullable().optional()` to `accounts/domain/account.ts` (default `null` when absent), read as `due_date::text`, written on save; contract test `due date round-trips and defaults to null`. The public proof route (`accountProofRoutes`) is scoped too.

**Task 7 — notices + messages** (`notices/…`, `messages/…`). `notice_dismissals` stays keyed by notice (scoped through the notice's condo). `Thread` domain gains `residentId: string | null` and `apartmentId: string | null` (optional in the schema, default `null`); the lazy thread creation in compose's resolver fills them from the resident record. Contract: `thread keeps its resident and apartment links`.

**Task 8 — categories + settings + dashboard** (`categories/…`, `settings/…`, `dashboard/…`). Settings `get()` for a condo without a row throws `SettingsNotFoundError`(404) — every condo gets a row at creation. Category `replaceAll` deletes/reinserts only the condo's rows; new category ids are uuids. Dashboard summary sums only the condo's rows (contract: `summary ignores other condos' receipts, accounts and incomes`).

**Task 9 — users provisioning + drop legacy defaults** (`users/app/create-resident-login.ts`, `users/adapters/http/routes.ts`, `residents/adapters/http/routes.ts` login routes, migrations `018_drop_legacy_defaults`). `createResidentLogin(users, condos, hasher, { residentId, condominiumId, … })` also calls `condos.grant({ condominiumId, userId, role: 'morador', residentId })`; test `provisioning a login grants morador in the current condo`. The resident must belong to the current condo (resident lookup goes through the scoped `residents` repo ⇒ foreign resident → `ResidentNotFoundError` 404). `018` runs `ALTER TABLE … ALTER COLUMN condominium_id DROP DEFAULT` on the 9 tables; after it, `make api-check` must stay green — proof that every adapter writes the column. Remove the legacy unscoped constructors / `forCondo` shims.

Steps for each of Tasks 4–9:

- [ ] **Step 1:** update the contract + pg test factory, add the isolation test(s) and the feature-specific tests named above; update `compose.test.ts` with the HTTP isolation test.
- [ ] **Step 2:** `make api-test` → FAIL on the new tests.
- [ ] **Step 3:** scope the adapter, routes and `repositories.ts`/`compose.ts` wiring.
- [ ] **Step 4:** `make api-check` → PASS.
- [ ] **Step 5:** commit `feat(<feature>): scope <feature> to the condominium` (+ Spec trailer).

### Task 10: Web — condo scope in the API client and session

**Files:**

- Create: `apps/web/src/shared/lib/condo-scope.ts` (+ test)
- Modify: `apps/web/src/shared/lib/api-client.ts` (+ test), `apps/web/src/app/container.ts`, `apps/web/src/features/session/ui/session-store.ts`, `apps/web/src/app/app.tsx`, the 4 proof `href`s (`accounts/ui/account-edit-screen.tsx:203`, `resident-home/ui/resident-finance-screen.tsx:109`, `residents/ui/resident-edit-screen.tsx:764`, `income/ui/income-edit-screen.tsx:165`)

**Interfaces:**

- Produces:
  ```ts
  // shared/lib/condo-scope.ts (zustand + persist, key 'morada-condo')
  export type CurrentCondo = { id: string; name: string };
  export const useCondoScope: UseBoundStore<…>; // state: { condo: CurrentCondo | null; setCondo(c: CurrentCondo | null): void; rename(name: string): void }
  export function scopedApiPath(path: string, condoId: string | null): string; // '/api/x' + 'c1' → '/api/condos/c1/x'; non-'/api/' paths unchanged; '/api/x' with null → throws Error('Nenhum condomínio selecionado')
  ```
- `createApiClient({ baseUrl, onUnauthorized, condoId?: () => string | null })` — when `condoId` is given, every request path goes through `scopedApiPath`; a **404 with body `Condomínio não encontrado`** is treated like 401 (`onUnauthorized`).
- `login()` in `container.ts` parses `{ condos: { id, name, role }[] }` with Zod, picks `condos[0]`, calls `useCondoScope.getState().setCondo({ id, name })` and `authenticate(role, null)`; `logout()` and `signOut` clear the condo too. `subject` is no longer returned by the API — keep the session store field but stop relying on it (resident screens already read `/residents/me`).
- On app boot, a persisted session with no persisted condo ⇒ sign out (Review Focus 5).
- Proof links: each of the 4 screens builds its `href` as `scopedApiPath('/api/<x>/<id>/proof', condoId)` with `condoId = useCondoScope((s) => s.condo?.id ?? null)`, keeping whatever base the current relative href resolves against (feature `ui` may import `shared/lib`, not `app`).

- [ ] **Step 1:** tests: `scopedApiPath` cases above; api-client `prefixes /api paths with the current condo`, `leaves /auth and /me paths alone`, `treats a condo-not-found 404 as unauthorized`; container/session `login stores the first condo and its role`, `boot with a session but no condo signs out`.
- [ ] **Step 2:** `make test` → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `make check` → PASS.
- [ ] **Step 5:** commit `feat(session): carry the current condominium in every api call`.

### Task 11: Web — condo name everywhere, rename in settings, account due date

**Files:**

- Create (via `make new-feature app=web name=condos spec=…`): `features/condos/domain/{condo-info.ts,condo-info-repository.ts}`, `features/condos/data/http-condo-info-repository.ts`, `features/condos/ui/use-condo-info.ts`
- API: `condos/adapters/http/routes.ts` `condoInfoRoutes(condos)` mounted at `/api/condos/:condoId/info`: `GET` → `{ id, name }` (any member), `PUT { name }` admin-only → renamed condo (also tested in `compose.test.ts`: `admin renames the condominium`, `resident cannot rename (403)`).
- Modify: every eyebrow/label listed by `grep -rn "Bloco 2\|Condomínio Morada" apps/web/src` (dashboard, accounts, account-edit, coming-soon, login, receipts, pay, resident-profile, receipt-proof) to use the current condo name; `settings-screen.tsx` gains a "Nome do condomínio" field saved through `PUT …/info` and pushed into `useCondoScope.rename`; `accounts` web domain/data/editor gain optional `dueDate` ("Vencimento", native date input, optional).
- The login screen (no condo yet) shows just "Morada" — no condo name.
- The notices default `audience` uses the condo name.

- [ ] **Step 1:** tests: screens render the condo name from the scope store (update the existing `Bloco 2` assertions to a fixture name like `Residencial Ipê`); settings `renames the condominium`; account editor `saves an optional due date`; receipt proof `prints the condo name`.
- [ ] **Step 2:** `make test` / `make api-test` → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `make check` and `make api-check` → PASS; `grep -rn "Bloco 2" apps/web/src apps/api/src --include=*.ts --include=*.tsx | grep -v test` → no output.
- [ ] **Step 5:** commit `feat(condos): show and rename the current condominium; account due date`.

### Task 12: e2e + docs

**Files:** `apps/web/e2e/journey.spec.ts`, `CLAUDE.md`, `docs/DATA-MODEL.md`, `docs/DEPLOY.md`

- [ ] **Step 1:** update the e2e journey for the new login response/paths; run `make e2e` → PASS.
- [ ] **Step 2:** `CLAUDE.md` — vocabulary adds `Organization`, `Condominium`, `OrgMember`, `CondoRole`; "Two roles" → roles per condominium (administrador/síndico/morador) + organization owner/member; note that all operational data is condominium-scoped. `DATA-MODEL.md` — new tables, `condominium_id` everywhere, per-condo uniqueness, access rule of `accessFor`. `DEPLOY.md` — "Migrating to multi-condomínio": backup command, what `015`–`018` do, post-deploy verification queries (counts per table, `condo-legacy` memberships).
- [ ] **Step 3:** commit `docs: multi-condominium data model and deploy notes` (`Spec:` trailer).

### Task 13: Migration rehearsal on a production copy (no push)

- [ ] **Step 1:** `pg_dump` the Neon production database (connection per `docs/DEPLOY.md`; credentials never printed) into `backups/morada-prod-pre-multicondo-<timestamp>.sql`.
- [ ] **Step 2:** restore it into a scratch database `morada_rehearsal` on the local docker Postgres; record `count(*)` of every table.
- [ ] **Step 3:** run the branch's migrations against `morada_rehearsal` (`DATABASE_URL=… pnpm --filter @morada/api exec tsx src/migrate-main.ts`); re-count; assert identical counts, zero NULL `condominium_id`, the real admin user has owner + administrador, every resident user has morador.
- [ ] **Step 4:** boot the API against `morada_rehearsal` and log in as the real admin through the web (`make start` with `DATABASE_URL` overridden) — dashboard numbers match production.
- [ ] **Step 5:** report results; drop `morada_rehearsal`. Pushing to `main` (which deploys) is a separate, explicit step with the user.
