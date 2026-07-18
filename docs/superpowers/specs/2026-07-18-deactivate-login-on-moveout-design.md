# Deactivate a resident's login on move-out — design

_2026-07-18_

## Context

`POST /api/residents/:id/deactivate` (the admin "Morador saiu" button) sets the
occupancy `active = false`, freeing the apartment for the next resident. But it
leaves the resident's `users` row untouched, and neither `verifyCredentials`
(`apps/api/src/users/app/verify-credentials.ts`) nor `authMiddleware`
(`apps/api/src/platform/auth.ts`) check whether the resident is still active. A
moved-out resident therefore keeps full access — they can still log in and read
their old data.

**Goal:** an inactive (moved-out) resident cannot access the app — neither a new
login nor an already-open session. Access is gated on the occupancy `active` flag,
which is the single source of truth. Nothing is deleted (per the project rule: no
hard deletes — soft-hide only).

## Decisions (locked)

1. **Block while keeping the record.** No `users` row is removed and no new column is
   added; the occupancy `active` flag alone drives access. Reactivating a resident
   (occupancy `active` → true) restores their login automatically.
2. **Enforce at both login and every authenticated request** — immediate session
   revocation, not just blocking new logins.
3. **Login rejection is generic:** reuse `InvalidCredentialsError` (401, "Usuário ou
   senha inválidos"), indistinguishable from a wrong password (enumeration-resistant).
4. **No reactivate route/UI** is added (none exists today); the mechanism already
   supports it for free.

## Design

### The guard

A single function, wired in the composition root (`apps/api/src/compose.ts`) from the
residents repository:

```
isResidentActive(residentId) := (await residents.getById(residentId))?.active === true
```

`residents.getById` already returns any resident (active or moved out) with their
occupancy `active` state, so no repository change is needed.

### Enforcement point 1 — login (`POST /auth/login`, inline in compose)

After `verifyCredentials` succeeds, if `user.role === 'resident'`, require
`isResidentActive(user.residentId)`. If not active, throw `InvalidCredentialsError`
**before** signing a token. Admin users skip the check. The dummy-hash timing
behaviour of `verifyCredentials` is unchanged.

### Enforcement point 2 — per-request guard (new middleware in compose)

Register a middleware on `/api/*` immediately after `api.use('*', authMiddleware)`:
for `c.get('role') === 'resident'`, require `isResidentActive(c.get('sub'))` (a
resident's `sub` is their resident id). If not active, return `401` ("Sessão
inválida"). Admin tokens skip. This revokes already-issued tokens on the next
request (adds one light `getById` read per authenticated resident request — accepted).

### Layering

Both enforcement points live in `compose.ts` (the composition root, which may import
residents). `platform/auth.ts` stays JWT-only. No `eslint-plugin-boundaries`
changes, no `users` schema change.

## What does not change

- The `users` table schema (no new column).
- The `deactivate` flow (already soft — sets occupancy `active = false`).
- The show-login / reset-password screen from the previous change.
- The web app: a `401` already redirects to login, and the login error message is
  surfaced automatically — no frontend change required.

## Testing (TDD)

HTTP-level in `apps/api/src/compose.test.ts`, mirroring existing auth/route tests
(in-memory fakes, admin/resident tokens):

- **Login:** an inactive resident is rejected with the generic 401; an active
  resident receives a token; an admin receives a token (unaffected).
- **Per-request:** an inactive resident holding a still-valid token gets 401 on an
  authenticated route (e.g. `GET /api/residents/me`); an active resident gets 200;
  an admin token is unaffected.
- **Regression:** an active resident's normal flow still works end-to-end.

## Out of scope

- Token-revocation infrastructure beyond the per-request active check (the 8h token
  lifetime is unchanged; the per-request check already gives immediate effect).
- A reactivate-resident route or UI.
