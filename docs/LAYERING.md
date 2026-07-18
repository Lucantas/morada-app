# Layering contract

Both apps share one mental model. The web app names its layers `domain/data/ui`;
the API names them `domain/app/adapters` — different vocabularies for the same
concerns (a UI app vs an HTTP service). This table is the single source of truth.

| Concern                                                 | Web (`apps/web`)             | API (`apps/api`)             | May import                                   |
| ------------------------------------------------------- | ---------------------------- | ---------------------------- | -------------------------------------------- |
| Pure core (zod entities, use cases, interfaces, errors) | `features/*/domain`          | `*/domain`                   | only `zod` + own/other domain + `shared/lib` |
| Use-case orchestration                                  | inside `domain` + `ui` hooks | `*/app`                      | domain, app, platform — no framework/driver  |
| External impls (HTTP client, Postgres, mappers)         | `features/*/data`            | `*/adapters/{http,postgres}` | domain, app, own layer, platform             |
| Delivery / UI                                           | `features/*/ui`              | `*/adapters/http` (routes)   | domain, shared/ui, shared/lib, shared/config |
| Composition / wiring                                    | `app/`                       | `compose.ts`                 | everything; **holds no feature logic**       |

## Rules

- **Dependency direction:** `ui`/`adapters` → `app` → `domain`. Domain never
  imports outward. Enforced by `eslint-plugin-boundaries` in both apps.
- **Parse at the boundary:** every adapter/data implementation zod-parses external
  input (HTTP responses, DB rows) into domain entities before returning upward.
  Raw rows never leak past the mapper.
- **Composition holds no logic:** `apps/api/src/compose.ts` and `apps/web/src/app`
  only construct dependencies and wire routers/routes. Route/handler logic lives
  in a feature's `adapters/http` (API) — enforced by lint (`no-restricted-syntax`
  on `compose.ts`).

## Allowed layer exceptions

Every feature has the full layer set, except these documented cases:

- `apps/web/src/features/session` — no `data` layer (no repository; session state
  is client-only).
- `apps/web/src/features/resident-home` — `ui` only (a screen composed from other
  features' hooks; owns no domain or data).

Any new feature needs the complete layer set. Adding a new exception requires a
spec entry.
