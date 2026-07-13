# Morada API

Hono + SQLite (better-sqlite3), hexagonal architecture (domain / app / adapters /
platform), Zod at every boundary, JWT auth. Boundaries are lint-enforced.

## Run

```bash
make api-dev        # or: pnpm --filter @morada/api dev  (serves on :8787)
make api-test       # pnpm --filter @morada/api test:coverage  (gate = 80%)
```

Env: `PORT`, `JWT_SECRET` (required in production — startup fails without it),
`DB_PATH` (default `morada.db`), `WEB_ORIGIN` (CORS, default Vite dev origin),
`BCRYPT_COST` (default 12).

## Auth model

- `POST /auth/login { username, password }` verifies bcrypt-hashed credentials and
  issues an HS256 JWT with a `role` claim and a `sub` (the resident's own id;
  admins get their user id). 8h expiry. Bad credentials return 401.
- Residents do **not** self-register. An admin provisions a resident login via
  `POST /api/users { username, residentId }` (admin-only). The server generates a
  temp password and returns it **once** in the response for the admin to relay;
  only the bcrypt hash is stored. Duplicate usernames return 409.
- `authMiddleware` verifies the token; `requireRole` guards admin routes.
- Authorization: residents/accounts/user-provisioning are **admin-only**;
  receipts/dashboard are any authenticated user; notices are read-any /
  **write-admin**; thread listing is **admin-only** and per-thread access is
  scoped to the caller's `sub` (a resident can only read/write their own thread).
- SQL is fully parameterized; passwords are hashed with bcrypt (never stored or
  logged in plaintext); message `author` is derived from the verified role
  (never trusted from the body); `POST` never accepts a client id.

## Seeded login

The database seeds **only the admin login** — **change it before any real
deployment** (it is intentionally weak). Every resident, their login, and all
accounts/receipts/notices are created through the app.

| Role  | Username | Password       |
| ----- | -------- | -------------- |
| Admin | `admin`  | `morada-admin` |

To onboard a resident: the admin creates the resident, provisions a login
(`POST /api/users`, which returns a one-time temp password), and hands over the
credentials. The resident then logs in normally.

## Still deferred (post-auth hardening)

1. **Per-resident receipt scoping.** Receipts are not yet linked to a resident
   (no owner column), so `/api/receipts` is open to any authenticated user. Once
   receipts carry a `resident_id`, scope reads/pay by the caller's `sub` — the
   same pattern threads already use — before real multi-resident use.
2. **Gate demo seeding for production.** `seedDatabase` runs on every boot and
   inserts the documented demo logins. Put it behind `!isProduction` / an
   explicit `SEED_DEMO_DATA` flag before deploying against a real database.
3. Refresh/revocation (logout) — tokens are valid for their full 8h.
4. A validated `WEB_ORIGIN` allowlist and CI action version bumps.
