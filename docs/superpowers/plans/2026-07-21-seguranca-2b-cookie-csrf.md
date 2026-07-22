# Segurança 2B — Cookie httpOnly + CSRF + CORS allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the session JWT out of `localStorage`/`Authorization` header into an httpOnly `session` cookie with a double-submit `csrf` cookie, add `POST /auth/logout`, switch CORS to `credentials:true` with a validated origin allowlist, and stop the web from persisting the raw token.

**Architecture:** The JWT is unchanged (HS256, `role`/`sub`/`exp`, 8h). Only the _transport_ changes: the API sets/reads cookies via `hono/cookie`; a double-submit CSRF middleware guards unsafe methods on `/api`; the web sends cookies with `credentials:'include'` and mirrors the readable `csrf` cookie into an `X-CSRF-Token` header. The web keeps `role`/`subject` for UI gating but no longer holds the token.

**Tech Stack:** Hono (`hono/cookie`, `hono/cors`), `node:crypto`, Zustand `persist`, Vite/React 19, Jest + Testing Library.

## Global Constraints

- **Spec trailer (enforced):** every commit touching a feature path (`apps/api/src/<feature>/**`, `apps/web/src/features/<feature>/**` — e.g. `users`, `session`) MUST carry the trailer `Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md`. Commits touching only `platform`/`compose.ts`/`shared`/top-level `apps/api/src/*.ts` do not require it (but the trailer is always safe to add).
- **No `any`, no non-null assertions, no `console.*`** — lint errors.
- **Immutability:** never mutate inputs; return new objects/arrays.
- **Validate at boundaries** with Zod. **Explicit errors** — nothing swallowed.
- **TDD:** failing test before implementation, in the same commit. **Coverage ≥ 80%** (`make api-check` gate = api Jest; `make check` gate = web Jest). Domain near 100%.
- **Conventional commits**, small and atomic. Never `--no-verify`.
- **Cookie attributes (exact):** `session` → `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=28800`, `Secure` only when `config.isProduction`. `csrf` → same but **not** `HttpOnly` (JS must read it).
- **Branch off `main`.** Run `make api-check` after every API task and `make check` after every web task before committing.

---

## File Structure

**API (`apps/api/src`)**

- `platform/cookies.ts` — **new.** Central cookie names + attribute builder (one source of truth for both set and clear).
- `platform/auth.ts` — **modify.** `authMiddleware` reads the `session` cookie instead of the `Authorization` header.
- `platform/csrf.ts` — **new.** Double-submit CSRF middleware for unsafe methods.
- `platform/config.ts` — **modify.** Parse `WEB_ORIGIN` into a validated origin **allowlist** (`webOrigins: string[]`), fail fast in prod.
- `users/adapters/http/auth-routes.ts` — **modify.** Login sets `session`+`csrf` cookies, body becomes `{ role, subject }`. Add `POST /logout`.
- `compose.ts` — **modify.** CORS `credentials:true` + allowlist + `X-CSRF-Token` header; mount CSRF middleware on `/api`; wire `/auth/logout`.
- `compose.test.ts`, `users/adapters/http/auth-routes.test.ts` — **modify.** Drive cookies + CSRF instead of bearer headers; the regression net.

**Web (`apps/web/src`)**

- `shared/lib/cookies.ts` — **new.** `readCookie(name)` helper (unit-tested).
- `shared/lib/api-client.ts` — **modify.** `credentials:'include'`, drop `Authorization`, send `X-CSRF-Token` on unsafe methods.
- `features/session/ui/session-store.ts` — **modify.** Drop `token` from state + `partialize`; `signOut` calls `/auth/logout`; remove the `isJwtActive` rehydrate check.
- `app/container.ts` — **modify.** `login()` reads `{ role, subject }` from the body; `apiClient` loses `getToken`.
- `shared/lib/jwt.ts` — **modify.** Remove `isJwtActive` + `decodeJwtSubject` once unused; delete the file if nothing remains.

---

## Task 1: API — cookie module + login issues cookies (additive)

Login keeps returning `{ token, role }` (non-breaking for the still-header-based tests) **and** additionally sets the two cookies. This lets us verify cookie issuance before flipping the read path.

**Files:**

- Create: `apps/api/src/platform/cookies.ts`
- Modify: `apps/api/src/users/adapters/http/auth-routes.ts`
- Test: `apps/api/src/users/adapters/http/auth-routes.test.ts` (create if absent) and/or `apps/api/src/compose.test.ts`

**Interfaces:**

- Produces: `SESSION_COOKIE = 'session'`, `CSRF_COOKIE = 'csrf'`, `sessionCookieOptions(isProd: boolean): CookieOptions`, `csrfCookieOptions(isProd: boolean): CookieOptions`, `clearCookieOptions(isProd: boolean): CookieOptions`, `newCsrfToken(): string`.

- [ ] **Step 1: Write the failing test** (in `compose.test.ts`, inside the describe block)

```ts
test('login sets httpOnly session cookie and a readable csrf cookie', async () => {
  const app = await makeApp();
  const res = await login(app, adminCredentials.username, adminCredentials.password);
  expect(res.status).toBe(200);
  const setCookies = res.headers.getSetCookie();
  const session = setCookies.find((c) => c.startsWith('session='));
  const csrf = setCookies.find((c) => c.startsWith('csrf='));
  expect(session).toMatch(/HttpOnly/i);
  expect(session).toMatch(/SameSite=Strict/i);
  expect(csrf).toBeDefined();
  expect(csrf).not.toMatch(/HttpOnly/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `make api-test` (or `pnpm --filter @morada/web exec jest` equivalent for api: `cd apps/api && pnpm jest compose.test.ts -t "csrf cookie"`)
Expected: FAIL — no `session`/`csrf` Set-Cookie present.

- [ ] **Step 3: Write `apps/api/src/platform/cookies.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { CookieOptions } from 'hono/utils/cookie';

export const SESSION_COOKIE = 'session';
export const CSRF_COOKIE = 'csrf';

const EIGHT_HOURS_SECONDS = 60 * 60 * 8;

export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: EIGHT_HOURS_SECONDS,
    secure: isProduction,
  };
}

export function csrfCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: false,
    sameSite: 'Strict',
    path: '/',
    maxAge: EIGHT_HOURS_SECONDS,
    secure: isProduction,
  };
}

export function clearCookieOptions(isProduction: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 0, secure: isProduction };
}

export function newCsrfToken(): string {
  return randomUUID();
}
```

- [ ] **Step 4: Set cookies in login** (`auth-routes.ts`) — add imports and set cookies before returning

```ts
import { setCookie } from 'hono/cookie';

import { config } from '../../../platform/config';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  csrfCookieOptions,
  newCsrfToken,
  sessionCookieOptions,
} from '../../../platform/cookies';
```

Replace the final `return c.json(...)` of `POST /login` with:

```ts
deps.limiter.succeed(key);
const subject = user.role === 'resident' ? (user.residentId ?? user.id) : user.id;
const token = await signSession(user.role, subject);
setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(config.isProduction));
setCookie(c, CSRF_COOKIE, newCsrfToken(), csrfCookieOptions(config.isProduction));
return c.json({ token, role: user.role, subject });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `make api-test`
Expected: PASS. Existing bearer-based tests still pass (body still has `token`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/platform/cookies.ts apps/api/src/users/adapters/http/auth-routes.ts apps/api/src/compose.test.ts
git commit -m "feat(users): set session and csrf cookies at login

Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md"
```

---

## Task 2: API — read the JWT from the session cookie (flip transport + migrate the test helper)

This is the breaking swap: `authMiddleware` stops reading `Authorization` and reads the `session` cookie. Every test that authenticated via a bearer header is updated **in this same commit** so the suite stays green.

**Files:**

- Modify: `apps/api/src/platform/auth.ts:18-36`
- Modify: `apps/api/src/compose.test.ts` (the `tokenFor`/request helpers)
- Modify: `apps/api/src/users/adapters/http/auth-routes.test.ts` if it asserts bearer behavior

**Interfaces:**

- Consumes: `SESSION_COOKIE` from Task 1.
- Produces: authenticated requests now carry a `Cookie: session=<jwt>` header; the test helper `authFor(app, creds)` returns `{ cookie: string; csrf: string }`.

- [ ] **Step 1: Rewrite the test auth helper** (`compose.test.ts`) — replace `tokenFor` with a cookie-based helper and update call sites

```ts
type Auth = { cookie: string; csrf: string };

function parseCookie(setCookies: string[], name: string): string {
  const raw = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!raw) throw new Error(`missing ${name} cookie`);
  return raw.split(';')[0].split('=').slice(1).join('=');
}

async function authFor(app: App, creds: { username: string; password: string }): Promise<Auth> {
  const res = await login(app, creds.username, creds.password);
  const setCookies = res.headers.getSetCookie();
  const session = parseCookie(setCookies, 'session');
  const csrf = parseCookie(setCookies, 'csrf');
  return { cookie: `session=${session}; csrf=${csrf}`, csrf };
}
```

Update every request that used `{ Authorization: \`Bearer ${token}\` }`to`{ Cookie: auth.cookie }`, and every mutating request to also send `{ 'X-CSRF-Token': auth.csrf }` (CSRF middleware lands in Task 4; sending the header now is harmless and avoids a second sweep). Example rewrite:

```ts
const auth = await authFor(app, residentCredentials);
const res = await app.request('/api/residents', { headers: { Cookie: auth.cookie } });
```

- [ ] **Step 2: Run to verify it fails**

Run: `make api-test`
Expected: FAIL — `authMiddleware` still reads the header, so cookie-only requests 401.

- [ ] **Step 3: Flip `authMiddleware`** (`apps/api/src/platform/auth.ts`)

```ts
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';

import { config } from './config';
import { SESSION_COOKIE } from './cookies';
```

Replace the header-reading lines with:

```ts
export const authMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: 'Não autenticado' }, 401);
```

(the rest of the function — `verify`, role/sub checks, `c.set` — is unchanged.)

- [ ] **Step 4: Run to verify it passes**

Run: `make api-test`
Expected: PASS. No test references `Authorization` anymore.

- [ ] **Step 5: Guard against regressions** — grep must be clean

Run: `grep -rn "Authorization\|Bearer" apps/api/src`
Expected: no matches in test or source.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/platform/auth.ts apps/api/src/compose.test.ts apps/api/src/users/adapters/http/auth-routes.test.ts
git commit -m "feat(api): authenticate from the session cookie instead of the Authorization header

Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md"
```

---

## Task 3: API — CSRF double-submit middleware on `/api`

**Files:**

- Create: `apps/api/src/platform/csrf.ts`
- Modify: `apps/api/src/compose.ts` (mount after `authMiddleware`)
- Test: `apps/api/src/compose.test.ts`

**Interfaces:**

- Consumes: `CSRF_COOKIE` from Task 1.
- Produces: `csrfMiddleware: MiddlewareHandler<ApiEnv>` — for `POST/PUT/PATCH/DELETE`, requires header `X-CSRF-Token` equal to the `csrf` cookie, else `403 { error: 'CSRF inválido' }`.

- [ ] **Step 1: Write the failing tests**

```ts
test('rejects a mutating request without a matching CSRF token', async () => {
  const app = await makeApp();
  const auth = await authFor(app, adminCredentials);
  const res = await app.request('/api/accounts', {
    method: 'POST',
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Água', category: 'Utilidades', valueCents: 1000, date: null }),
  });
  expect(res.status).toBe(403);
});

test('accepts a mutating request with the matching CSRF token', async () => {
  const app = await makeApp();
  const auth = await authFor(app, adminCredentials);
  const res = await app.request('/api/accounts', {
    method: 'POST',
    headers: {
      Cookie: auth.cookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': auth.csrf,
    },
    body: JSON.stringify({ title: 'Água', category: 'Utilidades', valueCents: 1000, date: null }),
  });
  expect(res.status).toBe(201);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `make api-test`
Expected: FAIL — the no-token request currently succeeds (201), not 403.

- [ ] **Step 3: Write `apps/api/src/platform/csrf.ts`**

```ts
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

import type { ApiEnv } from './auth';
import { CSRF_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }
  const cookie = getCookie(c, CSRF_COOKIE);
  const header = c.req.header('X-CSRF-Token');
  if (!cookie || !header || cookie !== header) {
    return c.json({ error: 'CSRF inválido' }, 403);
  }
  await next();
};
```

- [ ] **Step 4: Mount it in `compose.ts`** — right after `api.use('*', authMiddleware);`

```ts
const api = new Hono<ApiEnv>();
api.use('*', authMiddleware);
api.use('*', csrfMiddleware);
```

Add the import: `import { csrfMiddleware } from './platform/csrf';`

- [ ] **Step 5: Run to verify it passes**

Run: `make api-test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/platform/csrf.ts apps/api/src/compose.ts apps/api/src/compose.test.ts
git commit -m "feat(api): reject unsafe requests without a matching CSRF token"
```

---

## Task 4: API — `POST /auth/logout`

**Files:**

- Modify: `apps/api/src/users/adapters/http/auth-routes.ts`
- Modify: `apps/api/src/compose.ts` (logout must sit under CSRF protection; login must stay exempt)
- Test: `apps/api/src/compose.test.ts`

**Interfaces:**

- Produces: `POST /auth/logout` → clears both cookies (`Max-Age=0`), returns `204`. Requires the CSRF token (it is a state change).

**Design note:** `/auth/*` currently mounts _before_ `/api` and is **not** under `authMiddleware`/`csrfMiddleware`. To require CSRF on logout without requiring a valid session on login, apply `csrfMiddleware` to the logout route only.

- [ ] **Step 1: Write the failing tests**

```ts
test('logout clears the session cookie so the next request is unauthenticated', async () => {
  const app = await makeApp();
  const auth = await authFor(app, adminCredentials);
  const out = await app.request('/auth/logout', {
    method: 'POST',
    headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf },
  });
  expect(out.status).toBe(204);
  const cleared = out.headers.getSetCookie().find((c) => c.startsWith('session='));
  expect(cleared).toMatch(/Max-Age=0/i);
});

test('logout without a CSRF token is rejected', async () => {
  const app = await makeApp();
  const auth = await authFor(app, adminCredentials);
  const out = await app.request('/auth/logout', {
    method: 'POST',
    headers: { Cookie: auth.cookie },
  });
  expect(out.status).toBe(403);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `make api-test`
Expected: FAIL — no `/auth/logout` route (404).

- [ ] **Step 3: Add the logout route** (`auth-routes.ts`) — import `deleteCookie` and `csrfMiddleware`, add the route before `return app;`

```ts
import { deleteCookie, setCookie } from 'hono/cookie';
import { csrfMiddleware } from '../../../platform/csrf';
import { clearCookieOptions } from '../../../platform/cookies';
```

```ts
app.post('/logout', csrfMiddleware, (c) => {
  deleteCookie(c, SESSION_COOKIE, clearCookieOptions(config.isProduction));
  deleteCookie(c, CSRF_COOKIE, clearCookieOptions(config.isProduction));
  return c.body(null, 204);
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `make api-test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/users/adapters/http/auth-routes.ts apps/api/src/compose.test.ts
git commit -m "feat(users): add POST /auth/logout that clears the session cookies

Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md"
```

---

## Task 5: API — CORS `credentials:true`, `X-CSRF-Token`, drop `Authorization`

**Files:**

- Modify: `apps/api/src/compose.ts:58-65`
- Test: `apps/api/src/compose.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('CORS allows credentials for the configured origin', async () => {
  const res = await (
    await makeApp()
  ).request('/healthz', {
    headers: { Origin: config.webOrigins[0] },
  });
  expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe(config.webOrigins[0]);
});
```

(This test also depends on Task 6's `config.webOrigins`; if doing Task 5 first, temporarily use `config.webOrigin`. Recommended: do Task 6 before Task 5, or fold the origin reference after Task 6 lands. The reviewer should run both before merge.)

- [ ] **Step 2: Run to verify it fails**

Run: `make api-test`
Expected: FAIL — no `Access-Control-Allow-Credentials` header.

- [ ] **Step 3: Update the CORS block** (`compose.ts`)

```ts
app.use(
  '*',
  cors({
    origin: config.webOrigins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-CSRF-Token'],
  }),
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `make api-test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/compose.ts apps/api/src/compose.test.ts
git commit -m "feat(api): send credentials on CORS and drop the Authorization allow-header"
```

---

## Task 6: API — validated origin allowlist (folded-in extra)

`WEB_ORIGIN` becomes a comma-separated allowlist parsed into `config.webOrigins: string[]`; in production an empty/default allowlist fails fast at startup.

**Files:**

- Modify: `apps/api/src/platform/config.ts`
- Test: `apps/api/src/platform/config.test.ts` (create)

**Interfaces:**

- Produces: `config.webOrigins: string[]` (non-empty). Consumed by `compose.ts` CORS (Task 5).

- [ ] **Step 1: Write the failing test** (`config.test.ts`)

```ts
import { parseWebOrigins } from './config';

describe('parseWebOrigins', () => {
  test('splits a comma-separated list and trims blanks', () => {
    expect(parseWebOrigins('https://a.dev, https://b.dev')).toEqual([
      'https://a.dev',
      'https://b.dev',
    ]);
  });

  test('throws in production when no origin is configured', () => {
    expect(() => parseWebOrigins(undefined, true)).toThrow(/WEB_ORIGIN/);
  });

  test('falls back to localhost in development', () => {
    expect(parseWebOrigins(undefined, false)).toEqual(['http://localhost:5173']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && pnpm jest config.test.ts`
Expected: FAIL — `parseWebOrigins` is not exported.

- [ ] **Step 3: Implement in `config.ts`**

```ts
export function parseWebOrigins(raw: string | undefined, isProd: boolean): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (origins.length > 0) return origins;
  if (isProd) {
    throw new Error(
      'WEB_ORIGIN must be set in production — refusing to start without an allowlist.',
    );
  }
  return ['http://localhost:5173'];
}
```

Then in the `config` object replace `webOrigin: ...` with:

```ts
  webOrigins: parseWebOrigins(process.env.WEB_ORIGIN, isProduction),
```

Grep for other `config.webOrigin` readers and update them: `grep -rn "webOrigin\b" apps/api/src`.

- [ ] **Step 4: Run to verify it passes**

Run: `make api-check`
Expected: PASS (all api tests + lint + typecheck).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/platform/config.ts apps/api/src/platform/config.test.ts
git commit -m "feat(api): parse WEB_ORIGIN into a validated origin allowlist"
```

---

## Task 7: Web — `readCookie` helper + api-client uses cookies

**Files:**

- Create: `apps/web/src/shared/lib/cookies.ts`
- Create: `apps/web/src/shared/lib/cookies.test.ts`
- Modify: `apps/web/src/shared/lib/api-client.ts`
- Test: `apps/web/src/shared/lib/api-client.test.ts` (create if absent)

**Interfaces:**

- Produces: `readCookie(name: string): string | null`. `createApiClient` loses `getToken`; gains `credentials:'include'` and sends `X-CSRF-Token` from the `csrf` cookie on `POST/PUT/DELETE`.

- [ ] **Step 1: Write the failing `readCookie` test**

```ts
import { readCookie } from './cookies';

describe('readCookie', () => {
  test('returns the value for a present cookie', () => {
    Object.defineProperty(document, 'cookie', { value: 'a=1; csrf=abc; b=2', configurable: true });
    expect(readCookie('csrf')).toBe('abc');
  });

  test('returns null when the cookie is absent', () => {
    Object.defineProperty(document, 'cookie', { value: 'a=1', configurable: true });
    expect(readCookie('csrf')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/web exec jest cookies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `cookies.ts`**

```ts
export function readCookie(name: string): string | null {
  const target = `${name}=`;
  const found = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(target));
  return found ? decodeURIComponent(found.slice(target.length)) : null;
}
```

- [ ] **Step 4: Write the failing api-client test** (asserts credentials + CSRF header)

```ts
import { createApiClient } from './api-client';

test('sends credentials always and X-CSRF-Token on mutations', async () => {
  Object.defineProperty(document, 'cookie', { value: 'csrf=tok', configurable: true });
  const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  const client = createApiClient({ baseUrl: 'http://x' });
  await client.post('/api/thing', { a: 1 });
  const [, init] = fetchMock.mock.calls[0];
  expect(init.credentials).toBe('include');
  expect(init.headers['X-CSRF-Token']).toBe('tok');
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm --filter @morada/web exec jest api-client.test.ts`
Expected: FAIL — `getToken` still required; no `credentials`.

- [ ] **Step 6: Update `api-client.ts`** — drop `getToken`, add credentials + CSRF

```ts
import { readCookie } from './cookies';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createApiClient(opts: { baseUrl: string; onUnauthorized?: () => void }): ApiClient {
  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const csrf = UNSAFE.has(method) ? readCookie('csrf') : null;
    const res = await fetch(`${opts.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // ... unchanged 401/error handling and return ...
  };
  // ... unchanged returned object ...
}
```

- [ ] **Step 7: Run to verify both pass**

Run: `pnpm --filter @morada/web exec jest cookies.test.ts api-client.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/shared/lib/cookies.ts apps/web/src/shared/lib/cookies.test.ts apps/web/src/shared/lib/api-client.ts apps/web/src/shared/lib/api-client.test.ts
git commit -m "feat(web): send session cookies and a CSRF header from the api client"
```

---

## Task 8: Web — session store drops the token; login reads subject from the body

**Files:**

- Modify: `apps/web/src/features/session/ui/session-store.ts`
- Modify: `apps/web/src/app/container.ts`
- Modify: `apps/web/src/shared/lib/jwt.ts` (remove now-unused exports; delete file if empty)
- Test: `apps/web/src/features/session/ui/session-store.test.ts` (update/create)

**Interfaces:**

- Consumes: `POST /auth/login` body `{ role, subject }` (Task 1); `POST /auth/logout` (Task 4).
- Produces: `authenticate(role: Role, subject: string | null)` (token param removed); `signOut()` calls `/auth/logout` then clears state; persisted keys = `role`, `subject` only.

- [ ] **Step 1: Write the failing test** — store no longer persists a token, `authenticate` takes `(role, subject)`

```ts
test('authenticate stores role and subject without a token', () => {
  useSessionStore.getState().authenticate('admin', 'admin');
  const state = useSessionStore.getState();
  expect(state.role).toBe('admin');
  expect(state.subject).toBe('admin');
  expect('token' in state).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/web exec jest session-store.test.ts`
Expected: FAIL — `token` still in state; `authenticate` arity mismatch.

- [ ] **Step 3: Rewrite `session-store.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Role } from '../domain/session';

type SessionState = {
  role: Role | null;
  subject: string | null;
  authenticate: (role: Role, subject: string | null) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      subject: null,
      authenticate: (role, subject) => set({ role, subject }),
      signOut: () => set({ role: null, subject: null }),
    }),
    {
      name: 'morada-session',
      partialize: (state) => ({ role: state.role, subject: state.subject }),
    },
  ),
);
```

- [ ] **Step 4: Update `container.ts`** — `apiClient` loses `getToken`; `login` reads subject from the body; `signOut` calls logout

```ts
const apiClient = createApiClient({
  baseUrl: apiUrl,
  onUnauthorized: () => useSessionStore.getState().signOut(),
});
```

```ts
export async function login(username: string, password: string): Promise<Role> {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error('Usuário ou senha inválidos.');
  if (!res.ok) throw new Error('Não foi possível entrar. Verifique a conexão com o servidor.');
  const data = (await res.json()) as { role: Role; subject: string | null };
  useSessionStore.getState().authenticate(data.role, data.subject);
  return data.role;
}
```

Add a `logout` helper and wire `signOut` to call it (so the server clears cookies). Simplest: give `signOut` the network side-effect in the store is not possible (store must stay dependency-free); instead expose `export async function logout()` in container that calls `apiClient.post('/auth/logout')` then `useSessionStore.getState().signOut()`, and call it from the UI logout button. Update the profile/logout call site accordingly (`grep -rn "signOut" apps/web/src`).

```ts
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    useSessionStore.getState().signOut();
  }
}
```

- [ ] **Step 5: Remove dead JWT helpers** — delete `isJwtActive` and `decodeJwtSubject` if now unused

Run: `grep -rn "isJwtActive\|decodeJwtSubject" apps/web/src`
If only `jwt.ts` matches, delete `apps/web/src/shared/lib/jwt.ts` and its test; otherwise remove just the unused exports.

- [ ] **Step 6: Run the full web gate**

Run: `make check`
Expected: PASS (web Jest + lint + typecheck + prettier). Fix any remaining `token`/`getToken`/`jwt` references surfaced by typecheck.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/session apps/web/src/app/container.ts apps/web/src/shared/lib/jwt.ts
git commit -m "feat(session): stop persisting the token and log out via the server

Spec: docs/superpowers/specs/2026-07-18-seguranca-hardening-design.md"
```

---

## Task 9: Whole-branch verification + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Run both gates**

Run: `make api-check && make check`
Expected: both green; coverage ≥ 80%.

- [ ] **Step 2: Grep for leftovers**

Run: `grep -rn "Authorization\|Bearer\|getToken\|localStorage" apps/api/src apps/web/src | grep -v node_modules`
Expected: no auth-transport matches (a Zustand `persist` localStorage reference for role/subject is acceptable).

- [ ] **Step 3: Manual smoke on dev** (`make start`)

- Login as `admin` / `morada-admin` → DevTools shows `session` (HttpOnly) + `csrf` cookies; no token in `localStorage` (`morada-session` holds only role/subject).
- Do a mutating action (e.g. add an account) → succeeds (CSRF header sent).
- In DevTools, delete the `csrf` cookie and retry a mutation → 403.
- Logout → cookies cleared, app returns to login; a manual authenticated request now 401s.

- [ ] **Step 4: Final commit if any fixes were needed, then hand off for whole-branch review.**

---

## Self-Review

- **Spec coverage:** 2B.1 (Task 1), 2B.2 (Task 2), 2B.3 (Task 3), 2B.4 (Task 4), 2B.5 (Task 5), 2B.6 (Task 7 api-client), 2B.7 (Task 8 session store), 2B.8 (Task 9 verification). Folded-in allowlist (Task 6). All covered.
- **Placeholders:** the only prose-described edits are the mechanical call-site sweeps in `compose.test.ts` and the `signOut` call sites — both are grep-driven and unavoidable for a transport swap; the core file bodies are given in full.
- **Type consistency:** `authenticate(role, subject)` used identically in store (Task 8) and `login` (Task 8); `config.webOrigins` produced in Task 6, consumed in Task 5; `SESSION_COOKIE`/`CSRF_COOKIE`/`newCsrfToken` produced in Task 1, consumed in Tasks 2–4.

**Note on task order:** do **Task 6 before Task 5** (Task 5's CORS test reads `config.webOrigins`). The task numbering keeps the API-then-web grouping; the reviewer runs `make api-check` after the API block and `make check` after the web block regardless.
