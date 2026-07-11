# Testing

Global coverage gate: **80%** (branches/functions/lines/statements), enforced on
pre-push and `make coverage`. `src/app/**` (composition root) and `src/test/**`
(helpers) are excluded from coverage.

## Types

| Type        | Target                           | Tools                                                |
| ----------- | -------------------------------- | ---------------------------------------------------- |
| Unit        | `domain` use cases, `shared/lib` | Jest — aim near 100%                                 |
| Integration | `data` repositories              | Jest + in-memory adapter                             |
| Component   | `ui` screens/hooks               | Testing Library — behavior only (visible text/roles) |

## Conventions

- AAA (Arrange–Act–Assert).
- Names describe behavior: `test('lists residents newest first')`.
- Factories in `src/test/factories.ts`; never hand-roll entities in tests.
- Fake repositories implement the domain interface inline.
- UI tests wrap in a fresh `QueryClient` with `retry: false`.
- Colocated: `foo.ts` + `foo.test.ts`.
- Fix the implementation, not the test — unless the test contradicts the spec.
