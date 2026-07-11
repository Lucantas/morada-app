# Architecture

Feature-first clean architecture. Layers per feature, enforced by
`eslint-plugin-boundaries` in `apps/web/eslint.config.cjs` (violations are lint errors).

## Layers and allowed imports

| Layer               | Contains                                                                      | May import                                                                        |
| ------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `features/*/domain` | Entities (Zod schema + type), use cases, repository interfaces, domain errors | own/other feature `domain`, `shared/lib`, and (external) only `zod`               |
| `features/*/data`   | Repository implementations, DTOs, mappers                                     | any `domain`, own `data`, `shared/lib`. Denied: `react`, `@tanstack/*`, `zustand` |
| `features/*/ui`     | Screens, components, query hooks, stores                                      | any `domain`, own `ui`, `shared/ui`, `shared/lib`, `shared/config`                |
| `shared/ui`         | Design-system primitives                                                      | `shared/ui`, `shared/lib`                                                         |
| `shared/lib`        | Pure utilities + ports (Database)                                             | `shared/lib`                                                                      |
| `shared/config`     | Env, constants                                                                | `shared/config`, `shared/lib`                                                     |
| `app`               | Composition root (view router, providers, seed)                               | everything                                                                        |
| `test`              | Factories, in-memory adapter                                                  | everything (test-only)                                                            |

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
