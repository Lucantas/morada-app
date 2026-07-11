# Morada

A condominium-management app for a small building (Condomínio Morada · Bloco 2).
Two roles: an **admin** (síndico) manages residents, expenses, receipts, notices
and messages; a **resident** (morador) views receipts, pays the monthly fee via
Pix, and reads notices.

pnpm monorepo:

- `apps/web` — Vite + React 19 + TypeScript, feature-first clean architecture
  with lint-enforced boundaries (`ui → domain ← data`).
- `apps/api` — Hono + SQLite (better-sqlite3), hexagonal architecture, JWT auth.

Both sides validate with Zod at every boundary, are test-gated (≥80% coverage),
and share the same domain vocabulary. The web `data/` layer talks to the API
through HTTP repositories behind the same domain interfaces — so the app runs
either fully offline (seeded in-memory) or against the live API, with no domain
or UI changes.

## Quickstart

```bash
make install         # deps + git hooks

# Offline demo (seeded in-memory, no backend):
make dev             # web on :5173

# Full stack (two shells):
make dev-api         # API on :8787 (creates + seeds morada.db)
make dev-web         # web on :5173 pointed at the API (real login)

# Gates:
make check           # web: typecheck + lint(boundaries) + prettier + coverage
make check-api       # api: typecheck + lint(boundaries) + coverage
```

Log in by picking a role (Administrador / Morador). See
[apps/api/README.md](apps/api/README.md) for the auth model and its demo-only
caveats.

## Docs

- [CLAUDE.md](CLAUDE.md) — truth source: product, domain vocabulary, stack, rules.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers and enforced boundaries.
- [docs/WORKFLOW.md](docs/WORKFLOW.md) · [docs/TESTING.md](docs/TESTING.md).
