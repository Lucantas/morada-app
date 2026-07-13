# Roadmap & handoff

> Where the project is and what's next. Start here if you're picking up the work.
> Last updated 2026-07-13 (after PR #2).

## Where we are

A real, responsive, **no-fake-data** full-stack app (Vite + React 19 web, Hono +
SQLite API), TDD-gated (API/web ≥ 80% coverage), CI-green.

- **Auth** is real: `POST /auth/login {username,password}` → JWT whose `sub` is
  the resident's id. **Only the `admin` login is seeded** (`admin` /
  `morada-admin`); residents + their logins + all data are created in-app.
- **The apartment is the stable ledger key** — see [DATA-MODEL.md](DATA-MODEL.md):
  `apartments` + `residents` (person) + `apartment_residents` (occupancy, one
  active per apartment, DB-enforced). Receipts carry `apartment_id` + `resident_id`;
  a resident sees only their own, the admin can read an apartment's full history.
- **Turnover** works: `POST /api/residents/:id/deactivate` frees the apartment;
  the next resident reuses the same apartment id → continuous history.
- Dashboard is computed live from the ledger. Session persists across reloads.

Run it: `make start` (API :8787 + web :5173). `make reset-db` wipes the local DB.
Gates: `make check` (web), `make api-check` (api). Log in as `admin` / `morada-admin`.

## Architecture

Feature-first clean architecture, lint-enforced boundaries — see
[ARCHITECTURE.md](ARCHITECTURE.md). API mirrors it (domain / app / adapters /
platform). Repository pattern everywhere: the domain declares interfaces; adapters
implement them (SQLite today, Postgres next — domain/UI don't change). Workflow &
testing conventions in [WORKFLOW.md](WORKFLOW.md) / [TESTING.md](TESTING.md).

## Next phases (pick one; TDD, land as a PR off `main`)

### A. Deploy (the agreed Phase 2)

1. **Postgres adapter** — the repository-pattern payoff. Add a `pg`-backed
   implementation of each domain repository interface, env-selected
   (`DB_DRIVER=sqlite|postgres`); domain/UI unchanged. Port the schema in
   `apps/api/src/platform/db.ts` to migrations (incl. `apartments`,
   `apartment_residents`, the partial unique index, `receipts.apartment_id`).
2. **Deploy** the API (Fly.io/Render — set `JWT_SECRET`, `WEB_ORIGIN`, `PORT`,
   `BCRYPT_COST`) and the web (static host, built with `VITE_API_URL`).
3. **Gate demo seeding for prod**: `seedDatabase` (admin login) runs on every
   boot — put it behind `!isProduction` / a `SEED_DEMO_DATA` flag.
4. Write a deploy workflow and `docs/DEPLOY.md`.

### B. UI backlog

See [UI-BACKLOG.md](UI-BACKLOG.md). Highest-value: the admin **apartment general
view** (backend `GET /api/apartments/:id/receipts` exists; add a route to list a
resident's apartment history + the screen). Then empty states, move-out
confirmation, copy-temp-password, a richer issue-charge form, and the desktop
layout decision. The doc also lists open product questions.

### C. Hardening (small, deferred)

- **Deactivate the login on move-out** — a moved-out resident's login still works.
- **Per-resident "dismissed notice"** — today it's a global flag on the notice.
- Refresh/logout token flow (8h access token, no revocation); CORS origin
  allowlist at startup; bump CI `actions/*` majors; a committed Playwright e2e
  suite (login → onboard resident → issue charge → pay).
