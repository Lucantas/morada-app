# Morada API

Hono + SQLite (better-sqlite3), hexagonal architecture (domain / app / adapters /
platform), Zod at every boundary, JWT auth. Boundaries are lint-enforced.

## Run

```bash
make api-dev        # or: pnpm --filter @morada/api dev  (serves on :8787)
make api-test       # pnpm --filter @morada/api test:coverage  (gate = 80%)
```

Env: `PORT`, `JWT_SECRET` (required in production — startup fails without it),
`DB_PATH` (default `morada.db`), `WEB_ORIGIN` (CORS, default Vite dev origin).

## Auth model

- `POST /auth/login { role }` issues an HS256 JWT with a `role` claim and a `sub`
  (resident id / `'admin'`). 8h expiry.
- `authMiddleware` verifies the token; `requireRole` guards admin routes.
- Authorization: residents/accounts are **admin-only**; receipts/dashboard are
  any authenticated user; notices are read-any / **write-admin**; thread listing
  is **admin-only** and per-thread access is scoped to the caller's `sub`
  (a resident can only read/write their own thread).
- SQL is fully parameterized; message `author` is derived from the verified role
  (never trusted from the body); `POST` never accepts a client id.

## ⚠️ Demo-only login (not production-ready)

`/auth/login` picks a role with **no credential check**, matching the Morada
prototype (which has no password UI). Before any real deployment:

1. Wire real credential verification and a per-resident identity into `sub`.
2. Add refresh/revocation (logout) — tokens are currently valid for their full 8h.
3. Set `JWT_SECRET` (enforced in production) and a validated `WEB_ORIGIN`.
