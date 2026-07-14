# Roadmap & handoff

> Where the project is and what's next. Start here if you're picking up the work.
> Last updated 2026-07-14 (after the Postgres-adapter work landed on `main`).

## Where we are

A real, responsive, **no-fake-data** full-stack app (Vite + React 19 web, Hono
API), TDD-gated (API/web ≥ 80% coverage), CI-green. The API runs on **SQLite or
Postgres**, chosen at boot — the code is deploy-ready but not yet deployed.

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
- **Postgres adapter is done** (the repository-pattern payoff): every repository
  has a SQLite _and_ a Postgres implementation, selected by `DB_DRIVER`
  (auto-`postgres` when `DATABASE_URL` is set). A shared `*-repository.contract.ts`
  runs against **both** stores so they stay in lockstep. Schema lives in inlined
  migrations (`apps/api/src/platform/postgres/migrations.ts`), applied at boot.
  The demo admin seed is gated off in production unless `SEED_DEMO_DATA=1`.

Run it: `make start` (API :8787 + web :5173, SQLite). `make reset-db` wipes the local DB.
Gates: `make check` (web), `make api-check` (api SQLite). **Postgres:** `make db-up`
(dedicated pg on :5433) then `make api-test-pg` runs the pg contract; CI runs it too
against a service container. Log in as `admin` / `morada-admin`.

## Architecture

Feature-first clean architecture, lint-enforced boundaries — see
[ARCHITECTURE.md](ARCHITECTURE.md). API mirrors it (domain / app / adapters /
platform). Repository pattern everywhere: the domain declares interfaces; adapters
implement them (SQLite _and_ Postgres, driver-selected — domain/UI don't change).
Composition is in `apps/api/src/platform/repositories.ts` (`createRepositories`).
Workflow & testing conventions in [WORKFLOW.md](WORKFLOW.md) / [TESTING.md](TESTING.md).

> **Jest gotcha:** the SQLite adapter suite hit a native better-sqlite3 GC flake
> under coverage on low-core runners. It is fixed (the user adapter no longer
> relies on the DB index throwing — it checks explicitly, like residents). Don't
> reintroduce constraint-throw-dependent SQLite tests. Validate any test-infra
> change with `jest --coverage --maxWorkers=1` (the CI worst case), not `jest` alone.

## Next: Part 2 — Deploy (the code is ready; this ships it)

This is the agreed next step and needs the **user's cloud accounts + secrets**, so
do it **interactively** with them. TDD where it applies; land as a PR off `main`.

1. **Containerise the API.** Multi-stage `Dockerfile` (`apps/api`): the build stage
   needs C++/python for `better-sqlite3`'s native build (still a dependency even
   though prod uses Postgres); runtime stage is slim Node 22. Boot with
   `DB_DRIVER=postgres` + `DATABASE_URL`. Health check hits `/healthz`.
2. **Pick a host + managed Postgres** (Fly.io / Render / Railway). Set env:
   `JWT_SECRET` (required — API refuses to boot without it in prod), `DATABASE_URL`,
   `WEB_ORIGIN` (the deployed web URL, for CORS), `PORT`, `BCRYPT_COST`. Migrations
   run automatically on boot (`createRepositories` → `migrate`).
3. **Provision the real admin.** The demo `admin`/`morada-admin` seed is gated off
   in prod. Add a one-time way to create the first admin securely — e.g. seed from
   `ADMIN_USERNAME`/`ADMIN_PASSWORD` env at boot when `users` is empty, or a small
   `pnpm --filter @morada/api run create-admin` script. (Do NOT ship the weak seed.)
4. **Deploy the web** as a static site built with `VITE_API_URL=<deployed API URL>`
   (`apps/web` builds to `dist/`; `VITE_API_URL` is read in `apps/web/src/app/container.ts`).
   Any static host (Netlify/Vercel/Cloudflare Pages/the API's own static serving).
5. **`docs/DEPLOY.md`** documenting the above + a **CI deploy job** (extend
   `.github/workflows/ci.yml`) that builds/pushes the image and deploys on green `main`.
6. Bump CI `actions/*` to Node-24-compatible majors (current benign deprecation warning).

## Other tracks (independent of deploy)

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
