# E2E críticos (Playwright) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playwright e2e suite covering the critical Morada flows, runnable locally (`make e2e`, isolated DB) and in CI (new job), per `docs/superpowers/specs/2026-07-22-e2e-critical-flows-design.md`.

**Architecture:** Playwright drives ONLY the vite dev server (built with `VITE_API_URL=''`), whose existing `/api`+`/auth` proxy forwards to the API — same-origin cookies exactly like production's `_worker.js` proxy. Dedicated ports (web 5174, API 8788 via `API_PROXY_TARGET`) so a running `make start` (real DB!) is never reused. DB = `morada_e2e`, never `morada`.

**Tech Stack:** `@playwright/test` (Chromium only), `webServer` array, GitHub Actions.

## Global Constraints

- **DATA SAFETY (project rule):** e2e must NEVER touch the `morada` app DB. Everything runs against `morada_e2e` (local, auto-created) or the CI service DB. Any step that would point at `morada` is a defect.
- **Spec trailer:** commits here touch `apps/web` non-feature paths (`e2e/`, configs) and root files — trailer optional but safe: `Spec: docs/superpowers/specs/2026-07-22-e2e-critical-flows-design.md`. If any `apps/web/src/features/**` file is touched (shouldn't be), the trailer is MANDATORY.
- No fixed sleeps in specs — assert on visible state (Playwright auto-wait + `expect(...).toBeVisible()` etc.). Locators by role/label/text.
- Conventional commits; never `--no-verify`; prettier-format everything you touch (CI checks all files).
- `make check`/`make api-check` must stay green (e2e must not leak into jest/tsc/eslint scopes — verify `pnpm --filter @morada/web typecheck` and `lint` still pass untouched by the new dir, adjusting ignores minimally if needed).

---

## Task 1: Harness + smoke (login → dashboard)

**Files:**

- Modify: `apps/web/package.json` (devDep `@playwright/test`, script `"e2e": "playwright test"`)
- Create: `apps/web/playwright.config.ts` (testDir `./e2e`)
- Create: `apps/web/e2e/smoke.spec.ts`
- Create: `apps/web/e2e/global-setup.ts` (ensure `morada_e2e` exists + reset + migrate)
- Modify: `Makefile` (target `e2e`)
- Modify: `.gitignore` if needed (playwright-report/, test-results/)

**Interfaces:**

- Produces: `pnpm --filter @morada/web e2e` runs the suite; config exports `WEB_URL = http://localhost:5174`.

- [ ] **Step 1: Discover the DB bootstrap** — read how `make api-test` provisions `morada_test` (Makefile + `apps/api/src/test-support/pg.ts` + whether the API dev boot runs migrations — check `apps/api/src/main.ts`/dev entry). Mirror that mechanism for `morada_e2e` in `global-setup.ts`: create DB if missing (connect to the maintenance DB on :5433), run the API's `migrate(pool)` against it, TRUNCATE+reseed nothing (the API seeds the admin at boot in dev).
- [ ] **Step 2: `playwright.config.ts`** — Chromium only; `webServer` array:

```ts
import { defineConfig } from '@playwright/test';

const E2E_DATABASE_URL = 'postgres://morada:morada@localhost:5433/morada_e2e';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      command: 'pnpm --filter @morada/api dev',
      url: 'http://localhost:8788/healthz',
      reuseExistingServer: false,
      env: { PORT: '8788', DATABASE_URL: E2E_DATABASE_URL },
    },
    {
      command: 'pnpm --filter @morada/web dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      env: { VITE_API_URL: '', API_PROXY_TARGET: 'http://localhost:8788' },
    },
  ],
});
```

(Adjust the api dev command to the real script — read `apps/api/package.json`; the `cwd` of webServer commands is the config's dir, so `pnpm --filter` from there works via workspace resolution — verify, else use relative `cd`.) `reuseExistingServer: false` ALWAYS — never reuse a stack that may point at the real DB.

- [ ] **Step 3: smoke spec:**

```ts
import { expect, test } from '@playwright/test';

test('admin logs in and sees the dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/usuário|login/i).fill('admin');
  await page.getByLabel(/senha/i).fill('morada-admin');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page.getByText(/saldo/i).first()).toBeVisible();
});
```

(Read the real login screen for exact labels/roles before finalizing — `apps/web/src/features/session/ui/` — the assertion intent is fixed: authenticated dashboard content becomes visible.)

- [ ] **Step 4:** `make e2e` target: `db-up` prerequisite, then `pnpm --filter @morada/web e2e`. Run it → smoke green locally. Confirm `psql`-level that `morada` was untouched (no new rows).
- [ ] **Step 5:** `make check && make api-check` still green (e2e outside jest/tsc scopes).
- [ ] **Step 6:** Commit: `test(e2e): add playwright harness with isolated db and login smoke` + optional trailer.

---

## Task 2: Jornada crítica (serial)

**Files:**

- Create: `apps/web/e2e/journey.spec.ts`
- Create: `apps/web/e2e/fixtures/proof.png` (1x1 png, generate with a script or base64-decode inline in setup)

- [ ] **Step 1:** `test.describe.serial` covering, in order (read the real screens first for labels — `residents/ui`, `receipts/ui`, `dashboard/ui`):
  1. admin login → create resident (new apto number, name) → visible in the apartments list;
  2. provision the resident login → capture the temp password shown on screen into a variable;
  3. issue a charge (Adicionar on the resident ledger: ref/título/valor/vencimento) → pending receipt visible;
  4. NEW browser context: resident logs in with the captured temp password → sees the pending receipt → submits payment (pix + `setInputFiles` with the fixture) → "aguardando confirmação" state visible;
  5. back in the admin context: confirm the payment → receipt shows `pago` in the apartment ledger;
  6. resident context: logout → back at login; admin context: logout → back at login.
- [ ] **Step 2:** Run `make e2e` → all green, deterministically (run twice).
- [ ] **Step 3:** Commit: `test(e2e): cover the resident lifecycle journey end to end` + optional trailer.

---

## Task 3: CI job

**Files:**

- Modify: `.github/workflows/ci.yml` (new `e2e` job)

- [ ] **Step 1:** Add the job (same Postgres service pattern as the `api` job, port 5433):

```yaml
e2e:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:17-alpine
      env:
        POSTGRES_USER: morada
        POSTGRES_PASSWORD: morada
        POSTGRES_DB: morada_e2e
      ports:
        - 5433:5432
      options: >-
        --health-cmd "pg_isready -U morada -d morada_e2e"
        --health-interval 3s
        --health-timeout 3s
        --health-retries 10
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter @morada/web exec playwright install --with-deps chromium
    - run: pnpm --filter @morada/web e2e
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: apps/web/playwright-report/
        retention-days: 7
```

(Note: the service creates `morada_e2e` directly, so global-setup's create-if-missing is a no-op there; migrations still run.)

- [ ] **Step 2:** YAML sanity (`python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'))"`). Local full run of `make e2e` once more.
- [ ] **Step 3:** Commit: `ci: run the playwright e2e suite on every push and pull request`.

---

## Self-Review

- Spec coverage: topologia/isolamento → Task 1; jornada 7 fluxos → Task 2; CI+artefatos → Task 3. Complete.
- The only intentionally-open details are UI selectors (must be read from the real screens) — assertion intent is fully specified per step.
- Type consistency: ports 5174/8788 and `morada_e2e` appear identically in config, Makefile and CI.
