# Architecture

Feature-first clean architecture. Layers per feature, enforced by
`eslint-plugin-boundaries` in `apps/web/eslint.config.cjs` (violations are lint errors).

## Layers and allowed imports

See [LAYERING.md](./LAYERING.md) — the shared layering contract for both apps
(web `domain/data/ui` ↔ API `domain/app/adapters`), the dependency-direction
rule, and the documented layer exceptions.

## Key patterns

- **Repository pattern:** `domain` declares the interface; `data` implements it.
  Production and tests both use in-memory implementations of the same interface
  (a future HTTP API is a new implementation — domain/ui do not change).
- **Mapper at the data boundary:** external data is Zod-parsed and mapped to
  domain entities; raw rows never leak upward.
- **UI ↔ composition-root seam:** hooks and use cases take the repository as an
  argument; only `app/` constructs the concrete repository and injects it.
- **Use cases are functions** taking dependencies as arguments.

## Adding a feature

1. `features/<name>/domain` — entity schema, repository interface, use cases (TDD)
2. `features/<name>/data` — repository implementation + mapper (TDD)
3. `features/<name>/ui` — hooks + screens (TDD, Testing Library)
4. Wire the screen into `app/` view router.
5. Reference: `features/residents` — copy its structure exactly.
