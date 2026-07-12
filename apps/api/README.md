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

## Demo logins (seeded)

The database seeds two documented logins so the demo works out of the box —
**change or remove these before any real deployment** (they are intentionally weak):

| Role     | Username   | Password       |
| -------- | ---------- | -------------- |
| Admin    | `admin`    | `morada-admin` |
| Resident | `maria302` | `morada-demo`  |

## Still deferred (post-auth hardening)

1. Refresh/revocation (logout) — tokens are valid for their full 8h.
2. A validated `WEB_ORIGIN` allowlist and CI action version bumps.
