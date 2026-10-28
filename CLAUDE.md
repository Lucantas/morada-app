# Morada — Truth Source

## Product

Morada is a multi-condominium management app. An **organization** administers one
or more condominiums (the first is Condomínio Morada · Bloco 2). Roles are per
condominium: **administrador** manages residents, accounts/expenses, receipts,
notices and messages; **síndico** is a delegate with limited permissions (see Roles);
**morador** views their receipts, pays the monthly fee, and reads notices. An
organization **owner** is administrador of every condominium of the organization.
All operational data is condominium-scoped; one phone-framed UI.

**Roles.** `administrador` has every permission (`view_building`,
`publish_notices`, `manage_residents`, `manage_money`, `manage_fees`,
`manage_condo`, `view_activity`). `sindico` has `view_building`,
`publish_notices`, `manage_residents` and `manage_money`: no fee value, condo
rename, síndico/team management or activity log. `morador` has none. A staff
person who is also a resident of the same condominium switches between **"O
prédio"** and **"Minha casa"** (the web sends `X-Morada-View: admin|resident`).

**Domain vocabulary (use these exact names, never synonyms):**

- `Session` — the logged-in role: `admin` or `resident` (resolved per condominium)
- `Organization` — who administers one or more condominiums; owns them
- `Condominium` — an independent building; every operational row carries its `condominium_id`
- `OrgMember` — user ↔ organization link, role `owner` or `member`, `active` flag
- `CondoRole` — user ↔ condominium link, role `administrador` / `sindico` / `morador`, `active` flag
- `User` — a login; signs in by e-mail (legacy derived logins keep a `username`
  until the resident accepts an invitation). Never call it `Account`.
- `Invitation` — an invite with role `morador` (admin invites a resident),
  `sindico` (one active per condominium) or `membro` (organization team);
  `pendente` / `aceito` / `expirado` / `revogado`, one pending per resident
- `AuthToken` — a single-use e-mailed link (`confirm_email` or `reset_password`)
- `Apartment` — the stable unit and ledger anchor (`Apto 302`); survives resident
  turnover. **The apartment is the key, never the resident's name/login.** It also
  carries `block`, `floor`, `position` (where it is drawn) and `active` (deactivated,
  never deleted)
- `Building` — the drawing of a condominium: blocks → floors → windows, a projection
  of its active apartments (not stored). Unplaced apartments go in "Outras unidades"
- `Resident` — a person; belongs to an apartment via an `Occupancy`
- `Occupancy` (`apartment_residents`) — the apartment↔resident link with an
  `active` flag; **at most one active resident per apartment** (DB-enforced)
- `Account` — a condominium expense/lançamento (água, energia, …) with a status
- `Receipt` — a monthly fee charge tied to an `Apartment` **and** the `Resident`
  charged (`pago` / `pendente`); listable per-resident (own) or per-apartment (history)
- `Street` — the home screen of whoever administers more than one condominium:
  miniature buildings, `urgente` / `atenção` flags and "Pede atenção hoje"; a
  projection computed on the server (`GET /me/street`), never stored
- `Notice` — a communication the admin sends to residents (`aviso`)
- `Message` — a resident→admin message in the admin inbox
- `ThreadRead` — the "read" mark of a conversation, per person
- `ActivityEntry` — a row of the condominium activity log (`activity_log`):
  who did which write, when; visible to `administrador` in Ajustes → "Atividade"
- `CondoBalance` — condominium financial summary (saldo, entradas, contas pagas)
- `OpeningBalance` — `{ valueCents, date }` in `condo_settings`, set only by the
  onboarding; the balance is it plus the movements dated on or after `date`

The web identity flows (login, sign-up, confirmation, reset, invitation accept)
live in `apps/web/src/features/auth`.

See [docs/DATA-MODEL.md](docs/DATA-MODEL.md) for the apartment/resident/occupancy spec.

**Status vocabulary (exact):** `pago` · `pendente` · `atrasado`.

## Stack (do not substitute libraries)

| Concern            | Choice                                                      |
| ------------------ | ----------------------------------------------------------- |
| Framework          | Vite + React 19, TypeScript `strict`                        |
| View state         | Zustand (nav + session) — single phone-frame view machine   |
| Server/async state | TanStack Query (over in-memory repositories)                |
| Persistence        | In-memory repositories behind domain interfaces (API-ready) |
| Validation         | Zod at every boundary                                       |
| UI                 | Design tokens in `shared/ui/tokens.css` (Fraunces + Inter)  |
| Tests              | Jest (ts-jest) + Testing Library + jsdom                    |
| Hooks              | lefthook (pre-commit, commit-msg, pre-push)                 |
| Package manager    | pnpm (never npm/yarn)                                       |

## Repository layout

Monorepo (pnpm workspaces): `apps/web` is the app. Run commands as
`pnpm --filter @morada/web <script>` or via the Makefile.

## Architecture (enforced by lint — see docs/ARCHITECTURE.md)

`apps/web/src/features/<feature>/{domain,data,ui}` + `apps/web/src/shared/{ui,lib,config}`

- `apps/web/src/app` (composition root). Dependency direction `ui → domain ← data`;
  domain is pure TypeScript (only `zod`). `eslint-plugin-boundaries` makes
  violations lint errors — never disable or work around it.

**`residents` is the canonical reference feature. Copy its structure exactly.**

## Non-negotiables

1. **TDD.** Failing test before implementation, in the same commit.
2. **Coverage ≥ 80%** (pre-push gate). Domain near 100%.
3. **No `any`, no non-null assertions, no `console.*`** — lint errors.
4. **Immutability.** Never mutate inputs; return new objects/arrays.
5. **Comments only when extremely necessary.** No narration, no TODOs.
6. **Validate at boundaries.** Zod-parse everything entering the domain.
7. **Errors are explicit.** Wrap infra errors in domain errors; render explicit
   error states; nothing silently swallowed.
8. **Conventional commits**, small and atomic. Never `--no-verify`.
9. **Subagent-driven execution.** Implement plans one task at a time via a fresh
   subagent per task (superpowers:subagent-driven-development), reviewing between
   tasks. This is the default for any multi-task work here — never batch tasks
   inline unless explicitly told to.

## Commands

- `make start` — full stack (API :8787 + web :5173 wired to it); `make start-backend` /
  `make start-app` run the pieces (the web always targets the real API)
- `make test` / `make coverage` — web Jest (gate = 80%); `make api-test` for the API
- `make set-user-email username=… email=…` — set + verify a legacy user's e-mail
- `make check` — every web gate (hooks); `make api-check` — every API gate
