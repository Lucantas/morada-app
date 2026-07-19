# Security hardening — Plan 2A (tractable items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close five of the six security findings (rate limit, security headers, per-resident notice dismissal, vulnerable devDep, seed guard). The cookie+CSRF auth migration is Plan 2B, sequenced after this is green.

**Architecture:** API is Hono + Postgres (`apps/api`), feature-first hexagonal (`domain/app/adapters`), migrations as an ordered `{id, sql}[]` array in `apps/api/src/platform/postgres/migrations.ts`. Routes now live in feature `adapters/http` routers (compose.ts only wires — enforced by lint).

**Tech Stack:** Hono, `hono/secure-headers`, Postgres (`pg`), Zod, Jest (ts-jest), pnpm workspaces.

## Global Constraints

- **pnpm** only. TDD: failing test before impl, same commit. Coverage ≥ 80% (domain near 100%).
- No `any`, no non-null assertions, no `console.*` in app/src. Immutability. No comments unless essential.
- Conventional commits; **never `--no-verify`**. Prettier is a pre-commit gate — if `pnpm prettier` no-ops on a file, run `./node_modules/.bin/prettier --write <file>`.
- **Spec trailer:** a commit touching a feature path (`apps/api/src/<feature>/**`, excluding `platform`/`shared`/top-level `src/*.ts`) MUST carry `Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md`. Tasks noting "(feature path)" below need it; the others do not.
- `compose.ts` must stay route-free (lint rule forbids inline `.get/.post/.put/.patch/.delete/.all/.on`); add only `.use(...)`/`.route(...)` there.
- No hard deletes.

---

### Task 1: Bump `handlebars` (finding 5)

**Files:** Modify `package.json` (root and/or `apps/api/package.json`), `pnpm-lock.yaml`.

- [ ] **Step 1: Confirm the advisory**

Run: `pnpm audit --audit-level high`
Expected: advisories in the `handlebars` chain under `eslint-plugin-boundaries`.

- [ ] **Step 2: Update the plugin**

Run: `pnpm update eslint-plugin-boundaries -r` (recursive across the workspace).
If the advisory persists (no plugin release pulls patched `handlebars`), add to root `package.json`:

```json
"pnpm": { "overrides": { "handlebars@<4.7.9": ">=4.7.9" } }
```

then `pnpm install`.

- [ ] **Step 3: Verify clean**

Run: `pnpm audit --audit-level high`
Expected: no `handlebars` advisories. Then `make api-check` and `make check` still green (the boundaries lint still works).

- [ ] **Step 4: Commit**

```bash
git add package.json apps/api/package.json pnpm-lock.yaml
git commit -m "chore(sec): bump eslint-plugin-boundaries to patch handlebars advisory"
```

(No `Spec:` trailer — no feature path touched.)

---

### Task 2: Seed guard (finding 6)

**Files:** Modify `apps/api/src/seed-data.ts`; Test `apps/api/src/seed-data.test.ts` (create if absent).

**Interfaces:** `seedAdmin(users, hasher)` gains a guard: in production, if `users` already has any row, throw instead of seeding.

- [ ] **Step 1: Write the failing test**

Add a test that, given a `UserRepository` fake reporting an existing user and a production-like flag, `seedAdmin` throws (and does not call `save`). Use the repository's existing count/list method — read `apps/api/src/users/domain/user-repository.ts` to pick the right existence check (e.g. `findByUsername` already exists; if a general "any users" check is needed, add a small `hasAny()`/`count()` to the interface and its in-memory + postgres impls, or reuse an existing list). Prefer reusing an existing method; only extend the interface if none fits.

- [ ] **Step 2: Run it — fails.** `pnpm --filter @morada/api exec jest seed-data`

- [ ] **Step 3: Implement**

Guard in `seedAdmin`: when `config.isProduction` (import from `./platform/config`) and a user already exists, `throw new Error('Refusing to seed demo admin into a populated production database')`. Keep the existing idempotent no-op-when-admin-exists behavior for non-prod.

- [ ] **Step 4: Run it — passes.**

- [ ] **Step 5: Commit** (`seed-data.ts` is top-level `src/*.ts`, not a feature path → no trailer)

```bash
git add apps/api/src/seed-data.ts apps/api/src/seed-data.test.ts
git commit -m "feat(sec): refuse demo admin seed into a populated prod database"
```

---

### Task 3: API security headers (finding 3)

**Files:** Modify `apps/api/src/compose.ts` (add middleware); Test `apps/api/src/compose.test.ts` (add a headers assertion).

**Interfaces:** `hono/secure-headers` `secureHeaders(...)` mounted via `app.use('*', ...)` before routes.

- [ ] **Step 1: Write the failing test**

In `compose.test.ts`, add a test: a request to `/healthz` (or any route) has response headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Content-Security-Policy` containing `default-src 'none'`. (HSTS is prod-only; assert it is present only when a production config is used, or leave HSTS out of the default-config assertion.)

- [ ] **Step 2: Run it — fails.**

- [ ] **Step 3: Implement**

Import `secureHeaders` from `hono/secure-headers`. Add `app.use('*', secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] }, xFrameOptions: 'DENY', referrerPolicy: 'strict-origin-when-cross-origin', strictTransportSecurity: config.isProduction ? undefined_default : false, permissionsPolicy: { camera: [], microphone: [], geolocation: [] } }))` — consult the installed `hono` version's `secureHeaders` option names (read `node_modules/hono/dist/types/middleware/secure-headers` or the package types) and match them exactly; the option shape above is indicative. Place it after `app.onError`/`cors` and before route mounts. `X-Content-Type-Options: nosniff` is a `secureHeaders` default.

- [ ] **Step 4: Run it — passes.** `make api-check` green (headers don't break existing HTTP tests — if any test asserts exact header sets, update it).

- [ ] **Step 5: Commit** (compose.ts is not a feature path → no trailer, unless the test file edit is the only change; compose.test.ts is also not a feature path)

```bash
git add apps/api/src/compose.ts apps/api/src/compose.test.ts
git commit -m "feat(sec): add security headers middleware to the API"
```

---

### Task 4: Login rate limit (finding 1)

**Files:** Create `apps/api/src/platform/rate-limit.ts`, `apps/api/src/platform/rate-limit.test.ts`; Modify `apps/api/src/users/adapters/http/auth-routes.ts` (wire middleware) + `apps/api/src/compose.ts` (construct the limiter, pass to authRoutes); Test the 429 path in `apps/api/src/compose.test.ts`.

**Interfaces:**

- `createRateLimiter(opts?: { maxAttempts?: number; windowMs?: number; lockoutMs?: number })` → `{ check(key, now): { allowed: boolean }; fail(key, now): void; succeed(key): void }`. Pure w.r.t. time (caller passes `now`); internal `Map` with lazy expiry.
- `MAX_ATTEMPTS=5`, `WINDOW_MS=15*60*1000`, `LOCKOUT_MS=15*60*1000` as module constants.

- [ ] **Step 1: Write the failing limiter test**

`rate-limit.test.ts`: after 5 `fail(key, now)` calls, `check(key, now)` returns `{ allowed: false }`; `succeed(key)` clears it; after `LOCKOUT_MS` elapses (`check(key, now + LOCKOUT_MS + 1)`), it is allowed again; a different key is independent.

- [ ] **Step 2: Run it — fails.** `pnpm --filter @morada/api exec jest rate-limit`

- [ ] **Step 3: Implement `rate-limit.ts`**

A `Map<string, { count: number; windowStart: number; lockedUntil: number }>`. `check(key, now)`: if `lockedUntil > now` → not allowed; else allowed. `fail(key, now)`: reset the window if `now - windowStart > WINDOW_MS`; increment; if `count >= MAX_ATTEMPTS` set `lockedUntil = now + LOCKOUT_MS`. `succeed(key)`: delete the key. No timers, no `Date.now()` inside (accept `now`).

- [ ] **Step 4: Run it — passes.**

- [ ] **Step 5: Wire into the auth route (feature path)**

Read `apps/api/src/users/adapters/http/auth-routes.ts`. Change `authRoutes` to accept a `limiter` in its deps. In the `/login` handler: derive `clientIp` from `c.req.header('Fly-Client-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'`; `key = `${clientIp}:${username}``; if `!limiter.check(key, Date.now()).allowed` return `c.json({ error: 'Muitas tentativas, tente mais tarde' }, 429)` before verifying credentials; on `InvalidCredentialsError` call `limiter.fail(key, Date.now())` (catch, record, rethrow) and on success `limiter.succeed(key)`. In `compose.ts`, construct `const loginLimiter = createRateLimiter();` and pass it to `authRoutes({ ..., limiter: loginLimiter })`.

- [ ] **Step 6: HTTP test**

In `compose.test.ts`: 5 bad logins for the same username return 401; the 6th returns 429. A good login within the limit succeeds and resets.

- [ ] **Step 7: Run `make api-check` — green. Commit** (touches `users/**` → trailer)

```bash
git add apps/api/src/platform/rate-limit.ts apps/api/src/platform/rate-limit.test.ts apps/api/src/users/adapters/http/auth-routes.ts apps/api/src/compose.ts apps/api/src/compose.test.ts
git commit -m "feat(sec): rate-limit login attempts per ip+username

Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md"
```

---

### Task 5: Per-resident notice dismissal (finding 4)

**Files:** Modify `apps/api/src/platform/postgres/migrations.ts` (add `010_notice_dismissals`); `apps/api/src/notices/domain/notice-repository.ts` (interface); `apps/api/src/notices/adapters/postgres/notice-repository.ts` (impl); `apps/api/src/notices/app/dismiss-notice.ts` + `list-notices.ts` + `active-notices.ts` (+ their tests); `apps/api/src/notices/adapters/http/routes.ts`; the in-memory/test repo under `apps/api/src/test-support` or the notices test doubles. All feature-path → trailer.

**Interfaces:**

- `NoticeRepository.list(viewerResidentId: string | null): Promise<Notice[]>` — `dismissed` = a dismissal row exists for `viewerResidentId` (always `false` when `null`/admin).
- `NoticeRepository.dismiss(noticeId: string, residentId: string): Promise<Notice>` — inserts a join row (`on conflict do nothing`), returns the notice as seen by that resident (`dismissed: true`).
- `save(notice)` no longer persists `dismissed` (column is gone).

- [ ] **Step 1: Migration**

Add to `migrations.ts`:

```
{ id: '010_notice_dismissals', sql: `
CREATE TABLE notice_dismissals (
  notice_id TEXT NOT NULL REFERENCES notices(id),
  resident_id TEXT NOT NULL,
  PRIMARY KEY (notice_id, resident_id)
);
ALTER TABLE notices DROP COLUMN dismissed;
` }
```

- [ ] **Step 2: Write failing tests**

- A repository/use-case test (against the test Postgres or the in-memory double, matching how other notice tests run — read `apps/api/src/notices/app/dismiss-notice.test.ts` first): resident A dismissing notice N makes `list('A')` show N `dismissed:true`, but `list('B')` shows N `dismissed:false`; `list(null)` (admin) shows `dismissed:false`.
- Update `dismiss-notice.test.ts` for the new `dismiss(id, residentId)` signature.

- [ ] **Step 3: Run — fails.**

- [ ] **Step 4: Implement**

- Domain interface: change `list`/`dismiss` signatures as above; keep `getById`/`save`/`remove`.
- Postgres impl: `list(viewer)` does a `LEFT JOIN notice_dismissals d ON d.notice_id = n.id AND d.resident_id = $1`, selecting `dismissed = (d.resident_id IS NOT NULL)`; when `viewer` is null, select `false`. `dismiss(id, residentId)` = `INSERT ... ON CONFLICT DO NOTHING` then return the notice with `dismissed:true`. `save` stops writing/reading `dismissed` (map it out; a freshly-saved notice is `dismissed:false`).
- `dismiss-notice.ts` use-case: `dismissNotice(repo, id, residentId)` → `repo.dismiss(id, residentId)` (keep the `getById` not-found check).
- `list-notices.ts`/`active-notices.ts`: thread the `viewerResidentId` through.
- Routes (`notices/adapters/http/routes.ts`): `GET /` passes `c.get('role') === 'admin' ? null : c.get('sub')` to `list`; `POST /:id/dismiss` passes `c.get('sub')`. Keep the admin guards on create/delete from the arch work.

- [ ] **Step 5: Run — passes.** `make api-check` green (migration runs in the test DB; coverage holds).

- [ ] **Step 6: Commit** (feature path → trailer)

```bash
git add apps/api/src/platform/postgres/migrations.ts apps/api/src/notices
git commit -m "feat(sec): make notice dismissal per-resident

Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md"
```

---

## Self-Review

**Spec coverage:** Finding 1 → Task 4; finding 3 → Task 3; finding 4 → Task 5; finding 5 → Task 1; finding 6 → Task 2. Finding 2 → Plan 2B (separate). ✓

**Placeholder scan:** Two tasks instruct "read the installed `hono` secureHeaders option names / the existing notice test harness and match exactly" — these are correctness guards (the exact option names / test-DB wiring must come from the real code), not deferred work. No TBD/TODO.

**Type consistency:** `createRateLimiter` returns `{ check, fail, succeed }`, consumed by `auth-routes` and `compose`. `NoticeRepository.list(viewer)`/`dismiss(id, residentId)` signatures are used consistently across postgres impl, use-cases, and routes.

**Ordering:** low-risk/independent first (bump, seed, headers), then rate-limit, then the DB-schema change last so a migration failure doesn't block the cheaper wins.
