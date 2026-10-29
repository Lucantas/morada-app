# Pendências pequenas (pós-SP5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the small follow-ups parked after SP4/SP5: Brazil-local "today" on the server, activity log for building/settings/condo writes, overdue accounts visible in Contas, a sane street for homes-only residents, and the "Seus condomínios" shortcut during onboarding.

**Architecture:** Four independent tasks touching existing features only; no migration. API changes stay inside `shared/domain`, `activity` and route call sites; web changes stay inside `accounts`, `street`, `onboarding` and `app/`.

**Tech Stack:** Hono + Jest (api), Vite/React 19 + Jest/Testing Library (web).

**Spec:** docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md

## Global Constraints

- Every feature commit carries the trailer `Spec: docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md`.
- Commit subjects start lowercase; body lines ≤ 100 chars; never `--no-verify`.
- No code comments; no `any`, no non-null assertions, no `console.*`.
- Web: a feature's `ui` imports only its own ui/domain + shared; cross-feature UI is injected from `app/`.
- Run `pnpm exec prettier --write` on touched files before committing.
- Gates: `make api-check` (api tasks), `make check` (web tasks).
- Business time zone: `America/Sao_Paulo`.

## Review Focus

- 22:00 in Brasília on the last day of a month: the server must still say it is that day/month (monthly receipts, dashboard month, street "hoje").
- An account `pendente` whose `dueDate` is yesterday must read "Atrasado" in Contas; one due today must not.
- A morador of two condos (no staff role) must never see "0 condomínios" or the empty "Pede atenção hoje".
- Adding/renaming/deactivating an apartment, saving Ajustes, renaming the condo each produce one activity row; failed writes (4xx) produce none.
- The shortcut inside onboarding must not show for a single-condo administrador whose only condo is the one being onboarded (`useCanSeeStreet` already gates this).

---

### Task 1: Brazil-local "today" on the server (and the two web stragglers)

**Files:**

- Create: `apps/api/src/shared/domain/today.ts`, `apps/api/src/shared/domain/today.test.ts`
- Modify (replace every `new Date().toISOString().slice(0, 10)` / local `today()` helper):
  `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts:93`,
  `apps/api/src/receipts/app/pay-receipt.ts:5-7`,
  `apps/api/src/receipts/adapters/http/routes.ts:75,92,141`,
  `apps/api/src/condos/adapters/http/routes.ts:45`,
  `apps/api/src/residents/app/list-residents.ts:6-8`, `apps/api/src/residents/app/get-resident.ts` (same helper if present)
- Modify web: `apps/web/src/features/accounts/ui/accounts-screen.tsx:51` → `todayIso().slice(0, 7)`;
  `apps/web/src/features/residents/ui/new-receipt-card.tsx:83` → `todayIso()` (from `@/shared/lib/dates`, already local time).

**Interfaces:**

- Produces: `export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'` and
  `export function todayIn(now: Date = new Date(), timeZone: string = BUSINESS_TIME_ZONE): string` returning `YYYY-MM-DD` (use `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })`).

- [ ] **Step 1: failing tests** in `today.test.ts`:
  - `todayIn(new Date('2026-10-31T23:30:00Z'))` → `'2026-10-31'` (20:30 in Brasília)
  - `todayIn(new Date('2026-11-01T01:30:00Z'))` → `'2026-10-31'` (22:30 in Brasília, UTC already next month)
  - `todayIn(new Date('2026-11-01T03:30:00Z'))` → `'2026-11-01'`
  - `todayIn(new Date('2026-01-01T02:00:00Z'), 'UTC')` → `'2026-01-01'`
- [ ] **Step 2:** run `pnpm --filter @morada/api test -- today` → FAIL.
- [ ] **Step 3:** implement; replace every call site listed above with `todayIn()` (keep injected `now` where a call site already has one, e.g. pass `todayIn(now())`).
- [ ] **Step 4:** `grep -rn "toISOString().slice(0, 10)" apps/api/src apps/web/src --include=*.ts --include=*.tsx | grep -v test` returns only test files or the in-memory web repo; `make api-check` and `make check` green.
- [ ] **Step 5:** commit `fix(api): "today" follows Brasília time, not UTC`.

### Task 2: Activity log covers building, Ajustes and condo rename

**Files:**

- Modify: `apps/api/src/activity/domain/activity.ts` (labels), `apps/api/src/activity/adapters/http/money-activity.ts` (table), `apps/api/src/compose.ts:158-164` (mount the middleware on the new prefixes)
- Test: `apps/api/src/activity/adapters/http/*.test.ts` (existing resolver tests) and `apps/api/src/compose.test.ts` (end-to-end through the app, like the existing activity cases)

**Interfaces:**

- New `ActivityAction`s and labels (exact copy):
  - `'apartment.added'`: `'Apartamento adicionado'` ← `POST ${BASE}/building/apartments`
  - `'apartment.renamed'`: `'Apartamento renomeado'` ← `PUT ${BASE}/building/apartments/:id`
  - `'apartment.deactivated'`: `'Apartamento desativado'` ← `POST ${BASE}/building/apartments/:id/deactivate`
  - `'settings.saved'`: `'Ajustes do condomínio salvos'` ← `PUT ${BASE}/settings`
  - `'condo.renamed'`: `'Condomínio renomeado'` ← `PUT ${BASE}/info`
- Rename the table/resolver to `ACTIVITY_TABLE` / `activityResolver` (file `activity-table.ts`) since it is no longer money-only; middleware mounted for prefixes `accounts, incomes, categories, receipts, residents, building, settings, info` (for `info`, also mount on `/info` exactly, since `PUT /info` has no sub-path — check the existing `/${prefix}/*` pattern matches the root and mount `/${prefix}` too if it does not).

- [ ] **Step 1: failing tests** in compose.test.ts: an administrador adds an apartment, renames it, deactivates it, saves settings, renames the condo → `GET /activity` lists those five labels with the actor's name; a síndico `PUT /settings` (403) records nothing.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `make api-check` green.
- [ ] **Step 5:** commit `feat(api): the activity log covers the building, Ajustes and the condo name`.

### Task 3: Overdue accounts stand out in Contas

**Files:**

- Create: `apps/web/src/features/accounts/domain/effective-status.ts` + test
- Modify: `apps/web/src/features/accounts/ui/accounts-screen.tsx` (`AccountRow`, `AccountsContent`), `accounts-screen.test.tsx`

**Interfaces:**

- `export function effectiveAccountStatus(account: Pick<Account, 'status' | 'dueDate'>, today: string): AccountStatus` — `'pago'` stays; `'atrasado'` stays; `'pendente'` with `dueDate` (non-null) `< today` → `'atrasado'`; otherwise unchanged.
- `export function overdueCount(accounts: Account[], today: string): number`.

- [ ] **Step 1: failing tests** — domain: due yesterday → atrasado; due today → pendente; no due date → pendente; pago with past due → pago. Screen (inject today via a `today?: string` prop defaulting to `todayIso()`): a pendente account due before today shows the "Atrasado" pill and the line `vence DD/MM/AAAA` (from `formatIsoDate`) under the category; with 2 overdue accounts a status line `2 contas vencidas` (1 → `1 conta vencida`) appears above "Lançamentos"; none → no line.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement: row secondary line becomes `category · date` plus ` · vence DD/MM/AAAA` when `dueDate` is set and the account is not pago; overdue line uses the existing `--atraso-700` color.
- [ ] **Step 4:** `make check` green.
- [ ] **Step 5:** commit `feat(web): overdue accounts stand out in Contas`.

### Task 4: Street for homes-only residents + shortcut during onboarding

**Files:**

- Modify: `apps/web/src/features/street/domain/street.ts` (+ test), `apps/web/src/features/street/ui/street-screen.tsx` (+ test), `apps/web/src/features/onboarding/ui/onboarding-flow.tsx` (+ test), `apps/web/src/app/app.tsx` (`AdminOnboarding` gets the shortcut)

**Interfaces:**

- `homesSummaryLine(count: number): string` → `Você mora em 1 condomínio` / `Você mora em N condomínios`.
- `OnboardingFlow` gains optional prop `headerAction?: ReactNode`, rendered right-aligned above the `Question`.
- `AdminOnboarding` in app.tsx receives `headerAction` built like the routers' one (`<StreetShortcut onClick={handleStreet} />` only — no ViewSwitch); `SessionRouter` passes it.

- [ ] **Step 1: failing tests** — street screen with `condos: []`, `homes: [A, B]`: shows `Você mora em 2 condomínios`, the "Onde você mora" list, "+ Novo condomínio" and "Sair"; does NOT show "condomínios ·" summary, the street row, the select, or "Pede atenção hoje". `ariaLabelOf` uses the singular for one window: `Ed. X, 1 apartamento`. Onboarding: rendering with `headerAction={<button>Seus condomínios</button>}` shows that button.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement (in `StreetContent`, branch on `condos.length === 0`; the "+ Novo condomínio" stays reachable as a standalone button in that branch).
- [ ] **Step 4:** `make check` green; `make e2e` green (street + onboarding specs).
- [ ] **Step 5:** commit `feat(web): homes-only street and the street shortcut during onboarding`.
