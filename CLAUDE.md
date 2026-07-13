# Morada — Truth Source

## Product

Morada is a condominium-management app for a small building (Condomínio Morada ·
Bloco 2). An **admin** (síndico) manages residents, accounts/expenses, receipts,
notices and messages; a **resident** (morador) views their receipts, pays the
monthly fee, and reads notices. Two roles, one phone-framed UI.

**Domain vocabulary (use these exact names, never synonyms):**

- `Session` — the logged-in role: `admin` or `resident`
- `Resident` — a person in an apartment (`Apto`), with a payment status
- `Account` — a condominium expense/lançamento (água, energia, …) with a status
- `Receipt` — a monthly fee charge for a resident (`pago` / `pendente`)
- `Notice` — a communication the admin sends to residents (`aviso`)
- `Message` — a resident→admin message in the admin inbox
- `CondoBalance` — condominium financial summary (saldo, entradas, contas pagas)

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

## Commands

- `make start` — full stack (API :8787 + web :5173 wired to it); `make start-backend` /
  `make start-app` run the pieces; `make dev` runs the web offline (in-memory)
- `make test` / `make coverage` — web Jest (gate = 80%); `make api-test` for the API
- `make check` — every web gate (hooks); `make api-check` — every API gate
