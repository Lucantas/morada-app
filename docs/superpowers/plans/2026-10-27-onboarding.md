# Onboarding (conversa, prédio que acende e térreo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-field "create condo" form with a conversation. The conversation captures the name, the structure (blocks, floors and apartments per floor), the fee and due day, and the Pix key. The condominium then appears as a building whose windows light up as residents are added. Below it sits a "térreo" with the categories, the month's spend and today's cash. The same building becomes the home screen of the administrador and the síndico.

**Architecture:**

- **Apartments get a place in the building.** `apartments` gains `block`, `floor`, `position` and `active`. The building drawing is a pure projection of the active apartments plus each one's occupant status.
- **One request creates the whole condominium.** `POST /me/condos` accepts the whole conversation. A single transaction creates the condo, its settings (fee, due day, Pix) and every generated apartment.
- **Steps 2 and 3 run on the real condo.** The condo's `onboarded_at` stays null until the person taps "Abrir o <nome>". While it is null, the staff home of a person with `manage_condo` is the onboarding flow.
- **The térreo reuses existing endpoints.** It saves through categories, accounts and settings. Settings gain an opening balance, and the dashboard balance starts from it.
- **The conversation resumes from where it stopped.** It is a pure reducer. Its draft is persisted in `localStorage`, so the person continues where they left off.

**Tech Stack:** Hono, node-pg, Zod, Jest (API on `morada_test`), Vite + React 19, Zustand, TanStack Query, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md`, sections 4, 9, 11 item 4, 13, 14 and 15. The visual reference is `.superpowers/brainstorm/62896-1792720229/content/onboarding-flow-v1.html`. It shows behaviour, not pixels.

## Global Constraints

**Commits and code rules**

- Every commit carries the trailer `Spec: docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md`. Never `--no-verify`.
- TDD: write the failing test first, in the same commit as the code.
- Coverage ≥ 80% on both gates.
- No `any`, no `!`, no `console.*`, no code comments.

**Validation and data**

- Zod at every boundary.
- Nothing is hard-deleted. Apartments flip `active`.
- A resource outside the caller's reach answers **404**. A missing permission answers 403 `"Acesso negado"`.
- Migrations are append-only in `apps/api/src/platform/postgres/migrations.ts`. The next id is `027_…`.
- Status vocabulary is exact: `pago` · `pendente` · `atrasado`.

**UI and copy**

- PT-BR copy. Mobile-first, the desktop is an extension, never a phone frame.
- Never a screen full of fields: the conversation asks one thing at a time.
- Exact copy:
  - Questions:
    - `"Que condomínio vamos gerenciar hoje?"`
    - `"Ele tem blocos ou é um prédio só?"`
    - `"Quantos andares, e quantos apartamentos por andar?"`
    - `"Quanto cada apartamento paga por mês, e até que dia?"`
    - `"E pra onde vai o Pix?"`
  - Chips: `"Depois eu vejo"`, `"Está vazio"`.
  - Final button: `"Abrir o <nome>"`.
- Animations respect `prefers-reduced-motion: reduce`: no transition and no stagger.

**Tests**

- Tests never touch the `morada` DB. Run `make e2e` before pushing.

## Decisions (mine, for Lucas to check)

1. **Blocks are an attribute of the apartment** (`apartments.block TEXT NULL`), not a table. The spec leaves this to the builder (§14).
2. **Generated labels:**
   - A single building gives `Apto <floor><position 2 digits>`, e.g. `Apto 101` or `Apto 1203`.
   - With blocks, the label is `Apto 101 · Bloco A`, which keeps labels unique per condo.
   - The first floor is 1.
   - Limits: 10 blocks, 60 floors, 20 apartments per floor, 2000 apartments in total.
3. **Legacy apartments are placed automatically.** Apartments labelled `Apto <n>` with n ≥ 100 get `floor = n / 100` and `position = n % 100`. Other labels have `floor NULL` and are drawn in an "Outras unidades" row under the building. The same rule places apartments created later by typing a number in the resident editor.
4. **The conversation creates the condo only at the end**, in one request. Steps 2 and 3 happen on the real condo, tracked by `condominiums.onboarded_at`.
   - Existing condos are backfilled with `now()`, so nobody already in production sees the onboarding.
   - The conversation draft lives in `localStorage` (`morada-onboarding-draft`). It resumes on the same device and is cleared on sign-out and on success. Steps 2 and 3 resume on any device, because they are server state.
5. **Correcting an answer means undoing the last one**: a "Corrigir" link under the last answer undoes it. There is no free editing of older answers.
6. **The opening balance** is `{ valueCents, date }` in `condo_settings`, all-or-none.
   - When it is set, the balance is the opening value plus the receipts, incomes and paid accounts dated on or after the opening date. Undated legacy rows are left out.
   - The onboarding's "gasto do mês" accounts are dated today, the same day as the opening balance. To keep "Em caixa" equal to what the person typed, the web saves the opening value as cash + month spend (`openingBalanceFor`).
   - Monthly income and paid totals are unchanged.
7. **Month-spend descriptions:**
   - Per category: `"<Categoria> de <mês>"`, e.g. `"Água de outubro"`.
   - Total only: `"Gastos de <mês>"`, in the category whose name is `Serviços`, or the first category if it was removed.
8. **The building is added to the home.** The current dashboard content (recent paid accounts, maintenances, "Enviar aviso") stays below the building and the térreo.
9. **Window states:** `vazio` (no active resident), `ocupado` (resident `em_dia`), `pendente`, `atrasado`, using the resident's derived status with its override.
10. **Tapping a window:**
    - An occupied window opens the resident editor.
    - An empty window opens the resident editor for a new resident with the apartment preset and read-only.
    - In onboarding step 2, it opens an inline sheet instead: name, phone and e-mail, then the existing "Acesso do morador" card to send the invite.
11. **Apartment management** (add, rename, deactivate) is administrador-only (`manage_condo`), in Ajustes → `"Estrutura do prédio"`.
    - Deactivating an apartment with an active resident answers 409 `"Apartamento com morador ativo"`.
    - Saving a resident on the label of a deactivated apartment reactivates it.
12. **The resident editor's apartment field** stays numeric for `Apto <digits>` labels. It becomes read-only for any other label (block labels), so editing a resident never rewrites `Apto 101 · Bloco A` into `Apto 101`.
13. **The opening balance is not editable in Ajustes in this sub-project.** It can only be set by the onboarding (YAGNI).
14. **SP5 owns "+ Novo condomínio" on the rua.** In this sub-project, the conversation runs for a confirmed user with no condominium, replacing `CreateCondoScreen`.

## Review Focus

1. **Big or odd structures** (12 floors × 8, 3 blocks, 1 floor × 1): the right labels and no collisions. Test it in Task 1.
2. **Resuming the conversation after a reload mid-way.** It continues at the same question with the earlier bubbles. A corrupt draft starts fresh. Test it in Task 6.
3. **Skipping everything in the térreo.** No request is sent, `onboarded_at` is set, and the home shows `R$ 0,00`. Test it in Task 7.
4. **The legacy condo after migration 027.** Every `Apto NNN` apartment is placed, nothing disappears, and the opening balance is null, so the balance is unchanged. Test it in Tasks 1 and 4.
5. **A síndico on a condo whose onboarding is pending** sees the normal home, not the onboarding, and cannot call `/onboarding/complete` (403). Test it in Task 2.

---

### Task 1: Building structure, migration 027 and full condo creation (API)

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (+ `migrations.test.ts`)
- Create: `apps/api/src/building/domain/structure.ts` (+ test)
- Create: `apps/api/src/building/domain/placement.ts` (+ test)
- Modify: `apps/api/src/condos/app/create-my-condominium.ts` (+ test)
- Modify: `apps/api/src/condos/domain/condo-repository.ts`, `apps/api/src/condos/adapters/postgres/condo-repository.ts`, `apps/api/src/condos/adapters/condo-repository.contract.ts`
- Modify: `apps/api/src/residents/adapters/postgres/resident-repository.ts` (new apartments get a placement; reactivate an inactive apartment)
- Test: `apps/api/src/compose.test.ts`

**Interfaces:**

- Migration `027_building`:
  - `apartments` adds:
    - `block TEXT`
    - `floor INTEGER`
    - `position INTEGER`
    - `active BOOLEAN NOT NULL DEFAULT TRUE`
  - Backfill `floor`/`position` per Decision 3, in SQL on `label ~ '^Apto [0-9]+$'` with number ≥ 100.
  - `condo_settings` adds `opening_balance_cents INTEGER` and `opening_balance_date DATE`, with check `condo_settings_opening_all_or_none`.
  - `condominiums` adds `onboarded_at TIMESTAMPTZ`, then `UPDATE condominiums SET onboarded_at = now()`.
- `building/domain/structure.ts`:
  - `structureSchema = z.object({ blocks: z.array(z.object({ name: z.string().trim().min(1).max(30).nullable(), floors: z.number().int().min(1).max(60), perFloor: z.number().int().min(1).max(20) })).min(1).max(10) })`
  - Refinements:
    - a `null` name only when there is exactly one block;
    - names are unique, case-insensitive;
    - the total is ≤ 2000.
  - `type GeneratedApartment = { label: string; block: string | null; floor: number; position: number }`
  - `generateApartments(structure: Structure): GeneratedApartment[]`
- `building/domain/placement.ts`: `placementFromLabel(label: string): { floor: number; position: number } | null`
- `CreateCondominiumInput` gains `apartments: GeneratedApartment[]` and `pix: PixSettings | null`. `CondoRepository.create` inserts them in its existing transaction, with one multi-row `INSERT … SELECT unnest(...)`.
- `createMyCondominium` input:

  ```ts
  z.object({
    name,
    structure: structureSchema.optional(),
    monthlyFeeCents: z.number().int().min(0).max(1_000_000_000).default(0),
    dueDay: z.number().int().min(1).max(28).default(10),
    pix: pixSettingsSchema.nullable().default(null),
  });
  ```

  `pixSettingsSchema` comes from `settings/domain/pix-key.ts`. A missing `structure` creates no apartments, which keeps old clients working.

- [ ] **Step 1: Write the failing tests**

`structure.test.ts`:

- `single building numbers floors from 1`:
  - `{ blocks: [{ name: null, floors: 2, perFloor: 3 }] }` gives the labels `['Apto 101','Apto 102','Apto 103','Apto 201','Apto 202','Apto 203']`;
  - every `block` is `null`;
  - positions are 1–3.
- `twelve floors pad the position`: `floors: 12, perFloor: 8` includes `'Apto 1208'`, and the count is 96.
- `blocks qualify the label`: two blocks `A` (1×2) and `B` (1×1) give `['Apto 101 · Bloco A','Apto 102 · Bloco A','Apto 101 · Bloco B']`.
- `rejects`:
  - a null name with two blocks;
  - duplicate names `'a'`/`'A'`;
  - 11 blocks;
  - 61 floors;
  - 21 per floor;
  - a total of 2001 (e.g. 10 blocks × 11 floors × 20 = 2200).

`placement.test.ts`:

| Label                  | Placement                    |
| ---------------------- | ---------------------------- |
| `'Apto 302'`           | `{ floor: 3, position: 2 }`  |
| `'Apto 1204'`          | `{ floor: 12, position: 4 }` |
| `'Apto 12'`            | `null`                       |
| `'Cobertura'`          | `null`                       |
| `'Apto 101 · Bloco A'` | `null`                       |

`create-my-condominium.test.ts`: the full input passes `apartments` (16 for 4×4), the `monthlyFeeCents: 35000`, `dueDay: 10` and `pix` to `create`. An invalid structure throws `CondoValidationError`.

`migrations.test.ts`: after 027, a legacy `Apto 302` row has `floor 3, position 2, active true`, a `'Loja'` row has `floor NULL`, and every pre-existing condo has a non-null `onboarded_at`.

`compose.test.ts` `POST /me/condos creates the building`:

- 201;
- then `SELECT count(*) FROM apartments WHERE condominium_id = <new>` is 16;
- `GET …/settings` returns the fee 35000, day 10 and the Pix.

Resident repository contract:

- `saving a resident on a new 'Apto 501' places it` on floor 5, position 1;
- `saving on a deactivated apartment's label reactivates it`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/api test -- structure placement create-my-condominium migrations compose resident-repository`
Expected: FAIL, the modules don't exist and 027 is not applied.

- [ ] **Step 3: Implement**

Follow the contract-test pattern of `residents`. `building/` gets only `domain/` in this task.

- [ ] **Step 4: Run the API gate**

Run: `make api-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(api): create the whole condominium from the onboarding conversation`

---

### Task 2: Onboarding pending flag and completion (API)

**Files:**

- Modify: `apps/api/src/condos/domain/condo-access.ts`, `apps/api/src/condos/adapters/postgres/condo-repository.ts` (grants SQL reads `onboarded_at`), `apps/api/src/condos/app/condo-access-views.ts` (+ test)
- Create: `apps/api/src/condos/app/complete-onboarding.ts` (+ test)
- Create: `apps/api/src/condos/adapters/http/onboarding-routes.ts`
- Modify: `apps/api/src/compose.ts` (`api.route('/onboarding', onboardingRoutes(condos))`)
- Test: `apps/api/src/compose.test.ts`

**Interfaces:**

- `CondoAccess` gains `onboardingPending: boolean`. `mergeGrants` keeps it as is, since it is the same per condo.
- `CondoSummary` gains `onboardingPending: boolean`. It appears in the login response, `/me`, `/me/condos` and the `POST /me/condos` result, where it is `true`.
- `CondoRepository.completeOnboarding(condoId: string): Promise<void>` runs `UPDATE … SET onboarded_at = now() WHERE id = $1 AND onboarded_at IS NULL`, so a second call is a no-op.
- `POST /api/condos/:id/onboarding/complete` is guarded by `requirePermission('manage_condo')` and answers 204.

- [ ] **Step 1: Write the failing tests**

- `condo-access-views.test.ts`: a summary from an access with `onboardingPending: true` carries it.
- `compose.test.ts`:
  - `new condo is pending until completed`:
    - `POST /me/condos` gives `onboardingPending: true`;
    - `POST /api/condos/:id/onboarding/complete` gives 204;
    - `GET /me/condos` gives `false`;
    - a second complete still gives 204.
  - `sindico cannot complete onboarding`: 403.
  - `legacy condo is not pending`: the seeded admin login gives `onboardingPending: false`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/api test -- condo-access-views compose`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the API gate**

Run: `make api-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(api): track and complete a condominium's onboarding`

---

### Task 3: Building view and apartment management (API)

**Files:**

- Create: `apps/api/src/building/domain/building.ts` (+ test)
- Create: `apps/api/src/building/domain/building-repository.ts`
- Create: `apps/api/src/building/domain/errors.ts`
- Create: `apps/api/src/building/app/get-building.ts`
- Create: `apps/api/src/building/app/manage-apartments.ts` (+ test)
- Create: `apps/api/src/building/adapters/postgres/building-repository.ts`
- Create: `apps/api/src/building/adapters/building-repository.contract.ts` (+ postgres test)
- Create: `apps/api/src/building/adapters/http/routes.ts`
- Modify: `apps/api/src/repositories.ts` (`building` in `forCondo`), `apps/api/src/compose.ts` (`api.route('/building', …)`), and the HTTP error mapping for the new errors
- Test: `apps/api/src/compose.test.ts`

**Interfaces:**

- `building/domain/building.ts`:
  - `apartmentStateSchema = z.enum(['vazio', 'ocupado', 'pendente', 'atrasado'])`
  - `buildingApartmentSchema = z.object({ id, label, state: apartmentStateSchema, residentId: z.string().nullable(), residentName: z.string().nullable() })`
  - `buildingSchema = z.object({ blocks: z.array(z.object({ name: z.string().nullable(), floors: z.array(z.object({ floor: z.number().int(), apartments: z.array(buildingApartmentSchema) })) })), unplaced: z.array(buildingApartmentSchema) })`
  - `type PlacedApartment = { id: string; label: string; block: string | null; floor: number | null; position: number | null }`
  - `buildBuildingView(apartments: PlacedApartment[], occupants: { apartmentId: string; residentId: string; name: string; status: ResidentStatus }[]): Building`
  - Ordering:
    - blocks by name, with `null` first;
    - floors descending, so the top floor comes first;
    - apartments by position, then label;
    - `unplaced` by label.
  - The state comes from the occupant's status (`em_dia` gives `ocupado`). Without an occupant, the state is `vazio`.
- `BuildingRepository`:

  ```ts
  listActive(): Promise<PlacedApartment[]>
  add(input: { label: string; block: string | null; floor: number | null }): Promise<PlacedApartment>
  rename(id: string, label: string): Promise<PlacedApartment>
  deactivate(id: string): Promise<void>
  hasActiveResident(id: string): Promise<boolean>
  ```

  - `add` puts the apartment at the next position on that block/floor. If an inactive apartment has the same label, `add` reactivates and places it.

- Errors:
  - `ApartmentNotFoundError` → 404 `"Apartamento não encontrado"`
  - `ApartmentConflictError` → 409 `"Já existe um apartamento com esse nome"`
  - `ApartmentOccupiedError` → 409 `"Apartamento com morador ativo"`
  - `ApartmentValidationError` → 400
- Routes under `/api/condos/:id/building`:

  | Route                             | Guard           | Behaviour                                                               |
  | --------------------------------- | --------------- | ----------------------------------------------------------------------- |
  | `GET /`                           | `view_building` | `get-building` combines `building.listActive()` with `residents.list()` |
  | `POST /apartments`                | `manage_condo`  | `{ label: string 1..40, block: string                                   | null, floor: int 0..200 | null }` → 201 |
  | `PUT /apartments/:id`             | `manage_condo`  | `{ label }` → 200                                                       |
  | `POST /apartments/:id/deactivate` | `manage_condo`  | 204                                                                     |

- [ ] **Step 1: Write the failing tests**

`building.test.ts`:

- `draws floors top-down`: 2×2 apartments come out as floors `[2, 1]`, and floor 2 lists `Apto 201` then `Apto 202`.
- `maps occupant status to window state`: `em_dia` → `ocupado`, `atrasado` → `atrasado`, no occupant → `vazio`, and the name is carried.
- `blocks are ordered and unplaced apartments are separate`: a `floor: null` `'Loja'` goes to `unplaced`.

`manage-apartments.test.ts`:

- deactivating an occupied apartment throws `ApartmentOccupiedError`;
- a blank label throws `ApartmentValidationError`.

Contract:

- `add places at the next position`;
- `rename to an existing label conflicts`;
- `deactivated apartments leave listActive`;
- `add with a deactivated label reactivates`.

`compose.test.ts`:

- `GET building isolates condos`: condo B's id under condo A's path gives 404 on rename.
- `sindico sees the building but cannot change it`: GET 200, POST 403.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/api test -- building manage-apartments compose`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the API gate**

Run: `make api-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(api): building view and apartment management`

---

### Task 4: Opening balance in settings and the dashboard balance (API)

**Files:**

- Modify: `apps/api/src/settings/domain/condo-settings.ts`, `apps/api/src/settings/app/update-settings.ts` (+ tests), `apps/api/src/settings/adapters/postgres/settings-repository.ts`, `apps/api/src/settings/adapters/settings-repository.contract.ts`
- Modify: `apps/api/src/dashboard/domain/build-dashboard-summary.ts` (+ test), `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts` (+ contract)

**Interfaces:**

- `openingBalanceSchema = z.object({ valueCents: z.number().int().min(0).max(1_000_000_000), date: isoDateSchema })`
- `condoSettingsSchema` gains `openingBalance: openingBalanceSchema.nullable().default(null)`.
- `updateSettings` generalises the "absent keeps the stored value" rule from `pix` to `openingBalance`, through a list of preserved fields.
- `buildDashboardSummary(accounts, receipts, incomes, today, opening: OpeningBalance | null)`: per Decision 6, the balance is `opening.valueCents` plus the paid receipts and incomes, minus the paid accounts. It counts only entries whose date (`paidAt` for receipts, `date` otherwise) is ≥ `opening.date`. With `null`, it behaves as today.

- [ ] **Step 1: Write the failing tests**

`build-dashboard-summary.test.ts`:

- `opening balance starts the balance`:
  - opening `{ 1_230_000, '2026-10-27' }`;
  - an account paid `'2026-10-27'` of 348_000;
  - an account paid `'2026-10-01'` of 50_000;
  - an undated account of 10_000.
  - The result is `balanceCents === 882_000`. The month `paidCents` still counts both dated October accounts (398_000).
- `no opening balance keeps today's behaviour`: the existing fixtures are unchanged.

`update-settings.test.ts`:

- omitting `openingBalance` keeps the stored one;
- `null` clears it;
- a negative value throws `SettingsValidationError`.

Settings contract: saving and reading the opening balance round-trips.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/api test -- build-dashboard-summary update-settings settings-repository dashboard-repository`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the API gate**

Run: `make api-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(api): opening balance anchors the condominium balance`

---

### Task 5: Building feature and the building drawing (web)

**Files:**

- Create: `apps/web/src/features/building/domain/building.ts` (+ test)
- Create: `apps/web/src/features/building/domain/building-repository.ts`
- Create: `apps/web/src/features/building/data/http-building-repository.ts` (+ test)
- Create: `apps/web/src/features/building/data/in-memory-building-repository.ts` (+ test)
- Create: `apps/web/src/features/building/ui/use-building.ts`
- Create: `apps/web/src/features/building/ui/building-view.tsx` (+ test)
- Create: `apps/web/src/features/building/ui/building-view.module.css`, or inline styles with tokens, following `dashboard-screen.tsx`
- Modify: `apps/web/src/app/container.ts` (`buildingRepository`)

**Interfaces:**

- The domain schemas mirror Task 3: `ApartmentState`, `BuildingApartment` and `Building`, plus `countApartments(building): number`.
- The repository mirrors Task 3:

  ```ts
  get(): Promise<Building>
  addApartment(input: { label: string; block: string | null; floor: number | null }): Promise<void>
  renameApartment(id: string, label: string): Promise<void>
  deactivateApartment(id: string): Promise<void>
  ```

  The HTTP paths are `/api/building…`, which `scopedApiPath` rewrites.

- `buildingQueryKey(condoId: string) = ['building', condoId]`, and `useBuilding(repository)` reads the condo id from `useCondoScope`.
- `BuildingView` props:

  ```ts
  { building: Building; onSelectApartment: (apartment: BuildingApartment) => void; ground?: ReactNode; title?: string }
  ```

  - Each block is drawn as a roof, then floors top-down. Several blocks sit side by side, with horizontal scroll when wider than the screen.
  - Each window is a `<button>` with `aria-label` `"<label> · <state text>"`. The state texts are `vazio`, `ocupado por <nome>`, `pendente` and `atrasado`.
  - The window background uses the existing status tokens: `vazio` is a dashed outline, `ocupado` uses the lit colour from the mockup (`#f0e4c7`/`#8a6320`), and `pendente`/`atrasado` use the existing status token colours.
  - The `unplaced` apartments render as a row titled `"Outras unidades"`. `ground` renders under the building.
  - The background transitions over 400 ms, and floors fade in staggered 60 ms each. Both are off under `prefers-reduced-motion: reduce`.

- [ ] **Step 1: Write the failing tests**

`building-view.test.tsx`:

- `renders one button per apartment top floor first`: for a 2×2 building, the first window is `Apto 201`.
- `tapping a window reports it`: `onSelectApartment` is called with the `Apto 101` apartment.
- `occupied window names the resident`: `getByRole('button', { name: 'Apto 101 · ocupado por Ana' })`.
- `unplaced apartments get their own row`: `"Outras unidades"` is visible with `Loja`.
- `renders ground content`.

Plus `http-building-repository.test.ts`: the paths and the 404 → domain error mapping, in the style of the `http-settings-repository` test.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/web test -- building`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the web gate**

Run: `make check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(web): building feature and the building drawing`

---

### Task 6: The onboarding conversation (web)

**Files:**

- Create: `apps/web/src/features/condos/domain/create-condo.ts` (+ test)
- Create: `apps/web/src/features/onboarding/domain/conversation.ts` (+ test)
- Create: `apps/web/src/features/onboarding/data/local-draft-store.ts` (+ test)
- Create: `apps/web/src/features/onboarding/ui/conversation-screen.tsx` (+ test)
- Modify: `apps/web/src/features/auth/domain/auth-repository.ts`, `apps/web/src/features/auth/data/http-auth-repository.ts` (+ test)
- Modify: `apps/web/src/features/session/domain/login-response.ts` (+ test), `apps/web/src/shared/lib/condo-scope.ts` (+ test)
- Modify: `apps/web/src/app/entry-router.tsx` (+ test)
- Delete (move to git history): `apps/web/src/features/auth/ui/create-condo-screen.tsx` and its test, replaced by `ConversationScreen`

**Interfaces:**

- `create-condo.ts`: `createCondoInputSchema` mirrors the API input of Task 1. `type CreateCondoInput`.
- `AuthRepository.createCondo(input: CreateCondoInput): Promise<LoginCondo>`
- `loginCondoSchema` and `currentCondoSchema` gain `onboardingPending: z.boolean().default(false)`. The persisted store stays version 1; old drafts parse with `false`.
- `useCondoScope` gains `completeOnboarding(): void`, which sets `onboardingPending: false`.
- `conversation.ts`:
  - `type Question = 'name' | 'hasBlocks' | 'blockCount' | 'blockNames' | 'sameShape' | 'shape' | 'fee' | 'pix' | 'review'`
  - `type ConversationState = { answers: Answer[]; current: Question; shapeIndex: number }`. `Answer` is a tagged union per question, carrying its display text.
  - `startConversation(): ConversationState`
  - `answer(state, input: AnswerInput): { state: ConversationState } | { error: string }`. It validates every input with the same limits as Task 1.
  - `undo(state): ConversationState` removes the last answer.
  - `toCreateCondoInput(state): CreateCondoInput`. It is only valid at `review`.
  - `questionText(state): string` returns the exact copy from the Global Constraints, plus:
    - `"Quantos blocos?"`
    - `"Como se chama cada bloco?"`
    - `"Os blocos são iguais?"`
    - `"E o Bloco <nome>: quantos andares, e quantos apartamentos por andar?"`
    - `"Tudo certo? Vou montar o <nome>."`
- Question flow:
  1. `name`.
  2. `hasBlocks`, with the chips `"Só um prédio"` and `"Tem blocos"`.
  3. If it has blocks: `blockCount` (2..10), then `blockNames`. That question has the chip `"A, B, C…"` and also accepts comma-separated names. Then `sameShape`, with the chips `"Sim"` and `"Não"`.
  4. `shape`: floors and per floor, once, or once per block when the blocks differ.
  5. `fee`: a money input and a day input, with the chip `"Depois eu vejo"`, which gives fee 0 and day 10.
  6. `pix`: the key type, the key, the receiver name and the city, reusing `features/settings/domain/pix-draft.ts` validation. It has the chip `"Depois eu vejo"`, which gives `pix: null`.
  7. `review`: a bubble summary and the button `"Criar o <nome>"`.
- `local-draft-store.ts`:
  - `loadDraft(): ConversationState | null` parses with Zod and returns `null` on anything invalid or when storage throws;
  - `saveDraft(state): void`;
  - `clearDraft(): void`.
  - Key: `morada-onboarding-draft`. Every storage access is wrapped in try/catch.
- `ConversationScreen` props: `{ repository: AuthRepository; onCreated: (condo: LoginCondo) => void; onSignOut: () => void }`.
  - Each answer is a right-aligned bubble and each question a left-aligned bubble.
  - A single composer at the bottom changes with the question: a text, number or money field, or chips.
  - A `"Corrigir"` link sits under the last answer.
  - After the 201 response, it calls `clearDraft()`.
  - On sign-out, `entry-router` calls `clearDraft()`.

- [ ] **Step 1: Write the failing tests**

`conversation.test.ts`:

- `single building happy path`:
  - The answers are `'Residencial Ipê'`, `Só um prédio`, `{ floors: 4, perFloor: 4 }`, `{ feeCents: 35000, dueDay: 10 }` and `Depois eu vejo`.
  - They reach `review`, and `toCreateCondoInput` equals:

    ```ts
    { name: 'Residencial Ipê', structure: { blocks: [{ name: null, floors: 4, perFloor: 4 }] }, monthlyFeeCents: 35000, dueDay: 10, pix: null }
    ```

- `different blocks ask the shape per block`:
  - 2 blocks `A, B`, `Não`;
  - `shape` is asked twice, the second time with `"E o Bloco B: …"`.
- `equal blocks ask once and copy the shape`.
- `rejects 61 floors with a message and keeps the question`.
- `undo returns to the previous question`.
- `skipping the fee uses 0 and day 10`.

`local-draft-store.test.ts`:

- `round-trips a draft`;
- `corrupt JSON gives null`;
- `throwing storage gives null and does not throw`.

`conversation-screen.test.tsx`:

- `resumes from a saved draft`: with a draft at `fee`, the screen shows the name bubble and `"Quanto cada apartamento paga por mês, e até que dia?"`.
- `creates the condominium`: through the in-memory or mock repository, it calls `createCondo` with the full input, then `onCreated`.

`entry-router.test.tsx`: a confirmed user without condos sees `"Que condomínio vamos gerenciar hoje?"` from `ConversationScreen`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/web test -- conversation local-draft-store entry-router login-response condo-scope http-auth-repository`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the web gate**

Run: `make check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(web): onboarding conversation creates the condominium`

---

### Task 7: Onboarding steps 2 and 3, the building lights up and the térreo (web)

**Files:**

- Create: `apps/web/src/features/onboarding/domain/ground.ts` (+ test)
- Create: `apps/web/src/features/onboarding/domain/onboarding-repository.ts`
- Create: `apps/web/src/features/onboarding/data/http-onboarding-repository.ts` (+ test)
- Create: `apps/web/src/features/onboarding/ui/onboarding-flow.tsx` (+ test)
- Create: `apps/web/src/features/onboarding/ui/resident-sheet.tsx` (+ test)
- Create: `apps/web/src/features/onboarding/ui/ground-step.tsx` (+ test)
- Modify: `apps/web/src/app/app.tsx` (admin branch: a pending condo with `manage_condo` renders `OnboardingFlow`), `apps/web/src/app/container.ts`

**Interfaces:**

- `OnboardingRepository.complete(): Promise<void>` posts to `/api/onboarding/complete`.
- `ground.ts`:
  - `type GroundInput = { categories: string[]; spend: { kind: 'none' } | { kind: 'total'; cents: number } | { kind: 'byCategory'; items: { category: string; cents: number }[] }; cashCents: number | null }`
  - `type GroundPlan = { categories: string[] | null; accounts: { description: string; category: string; valueCents: number }[]; openingBalance: { valueCents: number; date: string } | null }`
  - `planGround(input: GroundInput, current: string[], today: string): GroundPlan`:
    - `categories` is `null` when unchanged from `current`;
    - spend items with 0 cents are dropped;
    - descriptions follow Decision 7, with the month in PT-BR lower case;
    - `openingBalanceFor(cashCents, spendTotal)` per Decision 6;
    - the opening balance is `null` when `cashCents` is `null`.
- `OnboardingFlow` props: `{ building, categories, accounts, settings, residents, invitations, onboarding, onDone }`, each a repository from the container.
  - **Step 2** shows `"Pronto, esse é o <nome>. Quem mora em cada um?"`, then `BuildingView`, then the button `"Agora as contas"`.
    - Tapping a `vazio` window opens `ResidentSheet`. Its fields are name (required), phone and e-mail. Saving calls `ResidentRepository.save({ name, apt: label, phone, email, status: 'em_dia' })` and invalidates the building query, so the window lights.
    - After saving, the sheet shows the existing "Acesso do morador" card for that resident, to send the invite, and a `"Fechar"` button.
    - Tapping an occupied window reopens the sheet on the access card.
  - **Step 3** shows `"Quais contas o prédio paga, e quanto tem em caixa hoje?"`, with the building and the `GroundStep` as its `ground`:
    - category chips toggle, preselected from `categories.list()`, plus a `"+ Outra"` input;
    - `"Gasto no mês"`, either per selected category or with a `"Só sei o total"` toggle, plus `"Depois eu vejo"`;
    - `"Em caixa hoje"`, with the chips `"Está vazio"` (0) and `"Depois eu vejo"` (null).
  - The final button is `"Abrir o <nome>"`. It saves the plan in this order:
    1. categories, when they are not null;
    2. each account (`status: 'pago'`, `date: today`);
    3. settings with `openingBalance` (it reads the current settings first and sends fee, day and the opening balance);
    4. `onboarding.complete()`.

    Then it calls `useCondoScope.completeOnboarding()` and `onDone()`.

  - Any failure shows `"Não foi possível salvar. Tente de novo."` and keeps the step. A retry repeats only the parts not yet saved, tracked in component state.
- The web settings schema gains `openingBalance: openingBalanceSchema.nullable().default(null)`, and `CondoSettingsUpdate` gains the optional `openingBalance`.

- [ ] **Step 1: Write the failing tests**

`ground.test.ts`:

- `per-category spend becomes paid accounts`: `[{ 'Água', 34800 }, { 'Energia', 0 }]` in October gives one account, `{ description: 'Água de outubro', category: 'Água', valueCents: 34800 }`.
- `total spend goes to Serviços`: the result is `'Gastos de outubro'` in `Serviços`. Without `Serviços`, it goes to the first category.
- `opening balance adds today's spend back`: cash 1_230_000 and spend 348_000 give the opening `{ 1_578_000, today }`.
- `skipped cash means no opening balance`.
- `unchanged categories are not saved`.

`onboarding-flow.test.tsx`:

- `adding a resident lights the window`: tap `Apto 101 · vazio`, fill `Ana`, save. The button `Apto 101 · ocupado por Ana` appears.
- `skipping everything just completes`: in the térreo, tap `"Depois eu vejo"` on both, then `"Abrir o Residencial Ipê"`. Only `onboarding.complete` is called, then `onDone`.
- `save failure keeps the step and retries only the rest`: settings fail once, and the retry does not re-create the accounts.

`app.test.tsx`:

- `pending condo opens onboarding for the administrador`;
- `pending condo shows the normal home for the síndico`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/web test -- onboarding ground app`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the web gate**

Run: `make check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(web): the building lights up and the térreo comes to life`

---

### Task 8: The building is the staff home (web)

**Files:**

- Modify: `apps/web/src/features/dashboard/ui/dashboard-screen.tsx` (+ tests): new props `building: BuildingRepository`, `categories: CategoryRepository`, `onSelectApartment`
- Create: `apps/web/src/features/dashboard/ui/ground-cards.tsx` (+ test)
- Modify: `apps/web/src/app/nav-store.ts` (+ test): `NavSnapshot` gains `apt?: string`, and `go` opts gain `apt`
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (+ test): new prop `presetApt?: string`, and the read-only apartment field per Decision 12
- Modify: `apps/web/src/app/app.tsx`

**Interfaces:**

- `GroundCards` props: `{ categories: string[]; monthSpentCents: number; cashCents: number }`. It renders three cards:
  - `"Contas"`, showing the count and the first three names joined with `" · "`;
  - `"Gasto no mês"`;
  - `"Em caixa"`.
- `DashboardScreen` renders `BuildingView` with `GroundCards` as `ground`, above the existing content. The data comes from the building, the categories and the dashboard balance (`paidCents`, `balanceCents`).
- `onSelectApartment(apartment)` in `app.tsx`:
  - a resident goes to `go('a-resident-edit', { residentId })`;
  - otherwise it goes to `go('a-resident-edit', { apt: apartment.label })`.
  - `ResidentEditScreen` gets `presetApt={apt}`.

- [ ] **Step 1: Write the failing tests**

- `dashboard-screen.test.tsx`:
  - `home shows the building and the térreo`: a window `Apto 101` exists, along with `"Em caixa"` and the formatted `balanceCents`;
  - `tapping an empty window asks for a new resident with that apartment`.
- `resident-edit-screen.test.tsx`:
  - `preset apartment is read-only`: the field shows `Apto 101 · Bloco A`, cannot be edited, and the save sends `apt: 'Apto 101 · Bloco A'`;
  - `numeric label stays editable`.
- `nav-store.test.ts`: `go` keeps `apt`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/web test -- dashboard-screen resident-edit-screen nav-store ground-cards`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the web gate**

Run: `make check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(web): the building becomes the staff home`

---

### Task 9: Ajustes → "Estrutura do prédio" (web)

**Files:**

- Create: `apps/web/src/features/building/ui/building-structure-screen.tsx` (+ test)
- Modify: `apps/web/src/features/settings/ui/settings-screen.tsx` (+ test): the row `"Estrutura do prédio"` is visible only with `manage_condo`
- Modify: `apps/web/src/app/nav-store.ts` (view `'a-building'`), `apps/web/src/app/app.tsx`

**Interfaces:**

- `BuildingStructureScreen` props: `{ repository: BuildingRepository; onBack: () => void }`.
  - It lists the apartments grouped by block and floor.
  - Each row has the actions `"Renomear"` (inline field) and `"Desativar"`. `Desativar` goes through the existing `ConfirmDialog`, with the copy `"O <label> sai do desenho do prédio. O histórico é preservado."`.
  - `"+ Apartamento"` opens a form with the label, the block (select from the existing blocks, or none) and the floor (number, optional).
  - Errors are shown with the API messages: 409 occupied and 409 conflict.

- [ ] **Step 1: Write the failing tests**

- `renames an apartment`.
- `deactivating an occupied apartment shows "Apartamento com morador ativo"`.
- `adds an apartment on a floor`.
- In `settings-screen.test.tsx`, `síndico does not see Estrutura do prédio`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @morada/web test -- building-structure-screen settings-screen`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the web gate**

Run: `make check`
Expected: exit 0.

- [ ] **Step 5: Commit**

`feat(web): manage the building's apartments in Ajustes`

---

### Task 10: e2e journey and docs

**Files:**

- Create: `apps/web/e2e/onboarding.spec.ts`
- Modify: `CLAUDE.md` (vocabulary: `Apartment` gains block/floor; new terms `Building` (the drawing, a projection of the active apartments) and `OpeningBalance`)
- Modify: `docs/DATA-MODEL.md` (migration 027, placement rule, opening balance), `apps/api/README.md` (new routes), `docs/DEPLOY.md` (027 is additive; existing condos are backfilled as onboarded)

**Interfaces:**

- Consumes the e2e helpers used by `roles.spec.ts`/`journey.spec.ts` for sign-up and e-mail confirmation.

- [ ] **Step 1: Write the e2e**

`onboarding.spec.ts`:

1. Sign up and confirm a fresh user (unique e-mail per run).
2. Answer the conversation: `Residencial Ipê`, `Só um prédio`, 4 floors × 4, R$ 350 day 10, `Depois eu vejo`.
3. Create it. 16 window buttons are visible.
4. Tap `Apto 101 · vazio` and add `Ana`. `Apto 101 · ocupado por Ana` is visible.
5. Tap `"Agora as contas"`, enter cash `12300`, and tap `"Abrir o Residencial Ipê"`.
6. The home shows the building and `"Em caixa"` with `R$ 12.300,00`.
7. Reload: the home stays, and the onboarding doesn't return.

Also add a resume check: reload during the conversation at the fee question, and the name bubble is still there.

- [ ] **Step 2: Run e2e and both gates**

Run: `make e2e && make check && make api-check`
Expected: all exit 0.

- [ ] **Step 3: Update docs, then commit**

`test(e2e): onboarding journey; docs for the building and opening balance`
