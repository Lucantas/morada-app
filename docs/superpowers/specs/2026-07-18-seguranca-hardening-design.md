# Security hardening — design

_2026-07-18_

## Context

A security review of the running app (real Postgres API, JWT auth, bcrypt,
server-side IDOR scoping) found the core auth model sound but flagged six
hardening gaps. This spec closes them. It is the second component of the
architecture-and-security work; the first (architecture & enforcement) shipped
separately (`2026-07-18-arquitetura-enforcement-design.md`).

Findings, by severity:

1. **HIGH** — no rate limiting on `POST /auth/login`; the seeded admin and every
   resident temp password are brute-forceable.
2. **HIGH** — the session JWT is persisted in `localStorage` (zustand `persist`),
   readable by any future XSS.
3. **MEDIUM** — no security headers on the API (no CSP/HSTS/X-Content-Type-Options/
   X-Frame-Options/Referrer-Policy/Permissions-Policy).
4. **MEDIUM** — notice "dismissed" is a global boolean on the `Notice`; any resident
   dismissing a notice hides it for the whole building.
5. **MEDIUM** — vulnerable transitive devDependency `handlebars` via
   `eslint-plugin-boundaries`.
6. **LOW** — the demo admin seed is env-gated but lacks a hard "don't seed into a
   populated prod DB" guard.

**Goal:** all six closed, behavior-preserving except where the finding _is_ the
behavior (notice dismissal, auth transport). No change to the roles, the domain
vocabulary, or the IDOR scoping already enforced server-side.

## Decisions (locked)

1. **Two implementation plans under this one spec.** Plan **2A** (findings 1, 3,
   4, 5, 6) — independent, low-risk. Plan **2B** (finding 2) — the cookie+CSRF
   auth-transport migration, isolated and sequenced last because a regression
   locks every user out. 2A ships and is verified before 2B starts.
2. **Rate limiter is in-memory** (per the deploy owner's choice). Documented
   limitation: Fly scales to zero, so the counter resets on cold start — it
   throttles a sustained burst against a warm instance, not a patient attacker
   who waits out the idle window. Accepted for a small single-tenant app.
3. **Auth moves to an httpOnly cookie with double-submit CSRF** (finding 2, full
   migration — the deploy owner chose robustness over the lighter SameSite-only
   option). `SameSite=Strict` is still set as defense in depth; the CSRF token is
   the primary cross-site protection.
4. **Notice dismissal becomes per-resident** via a `notice_dismissals` join
   table. `dismissed` stops being a stored column on `notices` and becomes a
   value computed per viewing resident.
5. **No hard deletes** (project rule): the seed guard refuses to _insert_, it
   never deletes; notice dismissal inserts a join row, never removes a notice.

## Design — Plan 2A

### 2A.1 Login rate limit (finding 1)

A small in-memory limiter keyed by `${clientIp}:${username}`:

- Track failed-attempt count + window start per key. On each `POST /auth/login`,
  before verifying credentials, reject with `429` (`Muitas tentativas, tente mais
tarde`) if the key is locked.
- On a failed credential check, increment; after `MAX_ATTEMPTS` (5) within
  `WINDOW` (15 min), lock the key for `LOCKOUT` (15 min). A successful login
  clears the key.
- `clientIp` is read from `Fly-Client-IP`, falling back to the first
  `X-Forwarded-For` hop, falling back to `'unknown'` (dev). Constants live in one
  module; the store is a `Map` with lazy expiry (no timer).
- Lives in `apps/api/src/platform/rate-limit.ts` (pure limiter, unit-tested) +
  wired as middleware on the auth route. The limiter is pure/injectable so tests
  drive time explicitly (pass a `now` argument — no wall clock inside).

### 2A.2 Security headers (finding 3)

Add `hono/secure-headers` middleware in the API composition, before routes:

- `Strict-Transport-Security` (prod only, via `config.isProduction`),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- A `Content-Security-Policy` scoped for a JSON API:
  `default-src 'none'; frame-ancestors 'none'; base-uri 'none'`.
- The web app is a static Vite build; its CSP/security headers are configured at
  its static host and are **out of scope for the API** here — tracked as a
  follow-up note in the plan, not implemented in this API-focused change (the web
  has no server to set headers from in this repo).

### 2A.3 Per-resident notice dismissal (finding 4)

- **Migration:** new table
  `notice_dismissals (notice_id text references notices(id), resident_id text,
primary key (notice_id, resident_id))`. Drop the `dismissed` column from
  `notices` in the same migration (the data model no longer stores it).
- **Domain:** `Notice.dismissed` stays in the schema as a computed field, but the
  repository interface changes: `list(viewerResidentId: string | null)` returns
  notices with `dismissed` = whether a dismissal row exists for that viewer;
  `dismiss(noticeId, residentId)` inserts a join row (idempotent — `on conflict
do nothing`). An admin viewer (or `null`) sees `dismissed: false` everywhere.
- **Routes:** `POST /notices/:id/dismiss` uses `c.get('sub')` as the resident id;
  `GET /notices` passes the caller's `sub` (or null for admin) to `list`. Admin
  create/delete unchanged.
- **Web:** no interface change to the resident's view (it already reads
  `dismissed`); the value is now correctly per-resident.

### 2A.4 Dependency bump (finding 5)

`pnpm update eslint-plugin-boundaries` (both apps) to pull a patched `handlebars`
(`>=4.7.9`); confirm `pnpm audit --audit-level high` reports no advisories in that
chain. If the boundaries plugin has no release that resolves it, pin a patched
`handlebars` via a `pnpm.overrides` entry in the root `package.json` and note it.

### 2A.5 Seed guard (finding 6)

In the seed path, in production refuse to seed the demo admin if the `users` table
already has any row (in addition to the existing `SEED_DEMO_DATA` env gate).
Surfaces a clear thrown error rather than silently overwriting/adding.

## Design — Plan 2B (cookie + CSRF auth migration)

### 2B.1 API — issue cookies at login

`POST /auth/login`, on success, in addition to (or instead of) the JSON token:

- Set `session` cookie: the JWT, `httpOnly`, `SameSite=Strict`, `Path=/`,
  `Max-Age=28800` (8h), `Secure` **only when** `config.isProduction` (so it
  travels over `http://localhost` in dev).
- Set `csrf` cookie: a crypto-random token (`node:crypto randomUUID`/`randomBytes`),
  **not** `httpOnly` (JS must read it), `SameSite=Strict`, `Path=/`, same
  `Max-Age`, `Secure` in prod.
- The response body keeps `{ role, subject? }` for immediate UI state; the raw
  token is no longer needed client-side.

### 2B.2 API — read JWT from the cookie

`authMiddleware` reads the JWT from the `session` cookie (`hono/cookie`
`getCookie`) instead of the `Authorization` header. The header path is removed.
Everything downstream (`role`/`sub` context, `requireRole`, `denyForeign*`) is
unchanged.

### 2B.3 API — CSRF middleware (double-submit)

A middleware on the `/api` group: for unsafe methods (`POST`, `PUT`, `DELETE`,
`PATCH`), require header `X-CSRF-Token` to be present and equal the `csrf` cookie
value; else `403` (`CSRF inválido`). Safe methods (`GET`, `HEAD`, `OPTIONS`) skip.
`POST /auth/login` is exempt (no session yet). Applied after `authMiddleware`.

### 2B.4 API — logout

`POST /auth/logout` clears both cookies (`Max-Age=0`) and returns `204`. Exempt
from CSRF (it only clears state) or requires the token — spec choice: **require**
the CSRF token (it is a state change and the token is available), consistent with
every other mutating request.

### 2B.5 API — CORS

`cors({ origin: config.webOrigin, credentials: true, allowHeaders:
['Content-Type', 'X-CSRF-Token'], allowMethods: [...] })`. `Authorization` is
dropped from allowed headers. `credentials: true` is required for the browser to
send/store the cookies cross-origin (dev `:5173`→`:8787`).

### 2B.6 Web — api-client

- `fetch` gains `credentials: 'include'`; the `Authorization` header is removed
  (`getToken` dependency dropped).
- For mutating methods, read the `csrf` cookie (`document.cookie` parse) and send
  it as `X-CSRF-Token`. A tiny `readCookie(name)` helper (unit-tested).
- `onUnauthorized` still fires on `401` (drives the return-to-login).

### 2B.7 Web — session store

`session-store` stops persisting `token` (drop it from state + `partialize`).
It keeps `role`/`subject` for UI gating; on `signOut` it calls `POST /auth/logout`
so the server clears the cookies. `onRehydrateStorage`'s expired-token check is
replaced by: on app load, a `401` from the first authenticated request (e.g.
`/residents/me` or the role's initial query) triggers `onUnauthorized` →
`signOut`. `isJwtActive`/`jwt.ts` client-side decode is no longer needed and is
removed.

### 2B.8 Sequencing & safety

2B ships after 2A is green. The API auth-flow tests (`compose.test.ts` +
`auth-routes` tests) are updated to drive cookies instead of bearer headers and
to assert CSRF rejection; they are the regression net. A green suite + a manual
login→action→logout check on dev gates the merge.

## What does not change

- Roles (`admin`/`resident`), the JWT claims (`role`, `sub`, `exp`), the 8h
  lifetime, bcrypt, the credential-verification timing defense.
- Server-side IDOR scoping (`denyForeignReceipt`/`denyForeignThread`,
  `requireRole`) — untouched.
- The domain vocabulary and status values.
- The architecture-enforcement gates from the first component (this work carries
  `Spec:` trailers pointing at _this_ spec on feature-touching commits).

## Testing (TDD)

- **2A.1 rate limit:** pure-limiter unit tests (lock after N, clears on success,
  window/lockout expiry via injected `now`); an HTTP test that a 6th bad login in
  the window returns `429`.
- **2A.3 dismissal:** repository/use-case tests that a dismissal by resident A
  does not mark the notice dismissed for resident B; migration applied in the test
  DB; admin list shows `dismissed:false`.
- **2A.5 seed guard:** a test that seeding is refused when users exist in a
  prod-configured context.
- **2B:** auth-flow tests over HTTP — login sets `session`+`csrf` cookies; an
  authenticated GET works with the cookie and no bearer header; a mutating request
  without `X-CSRF-Token` (or with a wrong one) is `403`; with the matching token
  it succeeds; logout clears cookies and a subsequent authenticated request is
  `401`. Web: `readCookie` unit test; api-client sends `X-CSRF-Token` on POST/PUT/
  DELETE and `credentials:'include'` always.
- Coverage ≥ 80% (domain near 100%) throughout; `make api-check` and `make check`
  green.

## Out of scope

- Moving the rate limiter to Postgres/Redis (in-memory chosen; revisit if the app
  scales beyond one instance or needs cold-start-durable lockouts).
- The web static host's CSP/security headers (no web server in this repo to set
  them; tracked as a deploy-config follow-up).
- Token rotation/refresh beyond the existing 8h lifetime.
- Any change to the architecture-enforcement tooling from the first component.
