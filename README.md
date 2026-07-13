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

# Full stack (one command):
make start           # API on :8787 + web on :5173 wired to it (Ctrl-C stops both)

# Or run the pieces separately:
make start-backend   # API on :8787 (creates + seeds morada.db)
make start-app       # web on :5173 pointed at the live API (real login)
make dev             # web on :5173 offline (seeded in-memory, no backend)

# Gates:
make check           # web: typecheck + lint(boundaries) + prettier + coverage
make api-check       # api: typecheck + lint(boundaries) + coverage
```

Log in with a username and password. See
[apps/api/README.md](apps/api/README.md) for the auth model and the seeded demo
logins.

## Docs

- [CLAUDE.md](CLAUDE.md) — truth source: product, domain vocabulary, stack, rules.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers and enforced boundaries.
- [docs/WORKFLOW.md](docs/WORKFLOW.md) · [docs/TESTING.md](docs/TESTING.md).
