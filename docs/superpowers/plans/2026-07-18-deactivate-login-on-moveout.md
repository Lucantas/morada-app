# Deactivate a Resident Login on Move-out — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An inactive (moved-out) resident cannot access the app — neither a new login nor an already-issued session — gated on the occupancy `active` flag.

**Architecture:** A single guard `isResidentActive(residentId)` defined in the composition root (`apps/api/src/compose.ts`, inside `buildApp`) from `residents.getById(...)?.active`. It gates two points: the `/auth/login` route (reject before issuing a token) and a new per-request middleware on `/api/*` (reject an inactive resident's existing token). Admin tokens are unaffected. `platform/auth.ts` stays JWT-only; no schema change; nothing deleted.

**Tech Stack:** Hono + `@hono/node-server`, `pg`, Zod, Jest (ts-jest) against a live Postgres. pnpm.

## Global Constraints

- Strict TDD: write the failing test first, in the same change. No `any`, no non-null assertions, no `console.*`. Immutability. Comments only when strictly necessary.
- Lint-enforced hexagonal boundaries: `platform` may import only `platform`; the guard lives in `compose.ts` (composition root, may import anything). Do NOT move the check into `platform/auth.ts`.
- No hard deletes and no `users` schema change — gate on the existing occupancy `active` flag only.
- Login rejection uses the generic `InvalidCredentialsError` (401, "Usuário ou senha inválidos") — indistinguishable from a wrong password.
- Verify each commit actually lands (`git log --oneline main..HEAD`); the pre-commit hook runs `prettier --check` on staged files, so run `pnpm format:check` (or `prettier --write`) before committing. Tests run via `make api-test` (brings up local pg on :5433, isolated `morada_test` DB).
- Facts: `buildApp(repos)` destructures `residents`, `users`; `hasher` is built just below. The `/auth/login` route and `const api = new Hono(); api.use('*', authMiddleware);` are inside `buildApp`. A resident JWT's `sub` is their resident id. Test helpers in `compose.test.ts`: `makeApp()`, `login(app, username, password)`, `tokenFor(app, creds)`, plus `adminCredentials` and `residentCredentials` (`maria302` → resident `r-1`, seeded active). The admin route `POST /api/residents/:id/deactivate` sets the occupancy inactive.

---

### Task 1: Block an inactive resident at login

**Files:**

- Modify: `apps/api/src/compose.ts` (add import; add the `isResidentActive` guard inside `buildApp`; add the active check in the `/auth/login` handler)
- Test: `apps/api/src/compose.test.ts`

**Interfaces:**

- Consumes: `residents.getById(id): Promise<Resident | null>` (Resident has `active: boolean`); `InvalidCredentialsError` from `./users/domain/errors` (`status = 401`).
- Produces: `const isResidentActive = (residentId: string | null): Promise<boolean>` — an in-`buildApp` closure reused by Task 2.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/compose.test.ts` (inside the top-level `describe('Morada API', ...)`), using the existing helpers:

```ts
test('an active resident can still log in', async () => {
  const app = await makeApp();
  const res = await login(app, residentCredentials.username, residentCredentials.password);
  expect(res.status).toBe(200);
});

test('an inactive (moved-out) resident cannot log in', async () => {
  const app = await makeApp();
  const admin = await tokenFor(app, adminCredentials);
  const deactivate = await app.request('/api/residents/r-1/deactivate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
  });
  expect(deactivate.ok).toBe(true);

  const res = await login(app, residentCredentials.username, residentCredentials.password);
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make api-test`
Expected: the `active resident can still log in` test passes (behaviour already exists), and `an inactive (moved-out) resident cannot log in` FAILS — an inactive resident currently still logs in, so the response is 200, not 401.

- [ ] **Step 3: Implement the guard and login check**

In `apps/api/src/compose.ts`, add the import near the other `./users/...` imports:

```ts
import { InvalidCredentialsError } from './users/domain/errors';
```

Inside `buildApp`, just after `const hasher = new BcryptPasswordHasher(config.bcryptCost);`, add the guard:

```ts
const isResidentActive = async (residentId: string | null): Promise<boolean> =>
  residentId !== null && (await residents.getById(residentId))?.active === true;
```

In the `/auth/login` handler, insert the check between `verifyCredentials` and the `subject` line:

```ts
const user = await verifyCredentials(users, hasher, username, password);
if (user.role === 'resident' && !(await isResidentActive(user.residentId))) {
  throw new InvalidCredentialsError();
}
const subject = user.role === 'resident' ? (user.residentId ?? user.id) : user.id;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make api-test`
Expected: both new tests PASS; the full suite stays green and the coverage gate (≥80%) is met.

- [ ] **Step 5: Commit**

```bash
cd /home/lucasdantas/Lucantas/morada
pnpm format:check
git add apps/api/src/compose.ts apps/api/src/compose.test.ts
git commit -m "feat(api): reject login for a moved-out (inactive) resident"
git log --oneline main..HEAD   # confirm the commit landed
```

---

### Task 2: Reject an inactive resident's existing session per-request

**Files:**

- Modify: `apps/api/src/compose.ts` (add a middleware on `/api/*` right after `api.use('*', authMiddleware);`)
- Test: `apps/api/src/compose.test.ts`

**Interfaces:**

- Consumes: `isResidentActive` (the in-`buildApp` closure from Task 1); `c.get('role')`, `c.get('sub')` set by `authMiddleware` (a resident's `sub` is their resident id).
- Produces: nothing new (behavioural change only).

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/compose.test.ts` (same `describe`):

```ts
test('an active resident can read their own record', async () => {
  const app = await makeApp();
  const token = await tokenFor(app, residentCredentials);
  const res = await app.request('/api/residents/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
});

test("an inactive resident's existing session is rejected on the next request", async () => {
  const app = await makeApp();
  const residentToken = await tokenFor(app, residentCredentials); // issued while active
  const admin = await tokenFor(app, adminCredentials);
  const deactivate = await app.request('/api/residents/r-1/deactivate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
  });
  expect(deactivate.ok).toBe(true);

  const res = await app.request('/api/residents/me', {
    headers: { Authorization: `Bearer ${residentToken}` },
  });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make api-test`
Expected: `an active resident can read their own record` passes; `an inactive resident's existing session is rejected on the next request` FAILS — the still-valid token currently returns 200 from `/api/residents/me`, not 401.

- [ ] **Step 3: Implement the per-request middleware**

In `apps/api/src/compose.ts`, immediately after `api.use('*', authMiddleware);`, add:

```ts
api.use('*', async (c, next) => {
  if (c.get('role') === 'resident' && !(await isResidentActive(c.get('sub')))) {
    return c.json({ error: 'Sessão inválida' }, 401);
  }
  await next();
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `make api-test`
Expected: both new tests PASS; full suite green; coverage gate met. (Admin-only route tests are unaffected because admin tokens skip the check.)

- [ ] **Step 5: Commit**

```bash
cd /home/lucasdantas/Lucantas/morada
pnpm format:check
git add apps/api/src/compose.ts apps/api/src/compose.test.ts
git commit -m "feat(api): revoke an inactive resident's session on each request"
git log --oneline main..HEAD   # confirm the commit landed
```

---

## Notes

- No web change is required: a `401` already routes the SPA back to login, and the login error message is surfaced automatically.
- Reactivation is automatic — if a resident's occupancy is set `active` again, both the login and per-request checks pass with no extra code.
