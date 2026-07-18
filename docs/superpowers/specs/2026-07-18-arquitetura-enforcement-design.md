# Architecture & enforcement hardening — design

_2026-07-18_

## Context

Morada already has strong bones: feature-first clean architecture in both apps,
`eslint-plugin-boundaries` in whitelist mode, TS `strict`, 80% coverage gates,
lefthook (pre-commit / commit-msg / pre-push), commitlint, and specs+plans
committed under `docs/superpowers/`. Server-side auth is real (JWT, `requireRole`,
per-subject IDOR scoping). This spec does **not** rewrite any of that.

It closes four gaps that make the architecture harder for an AI agent to follow
correctly, and turns the existing brainstorm-spec convention from discipline into
a machine-enforced gate:

1. **Two divergent layer vocabularies** — web (`domain/data/ui`) vs API
   (`domain/app/adapters`) — with no single documented mapping, so an agent
   carries two mental models.
2. **`compose.ts` drift** — ~240 lines with many **inline route definitions**
   (`/auth/login`, `/users`, `/residents/me`, `/residents/:id/login*`, receipt
   `create/edit/confirm/reject/ensure-month`, `apartments/:id/*`) that bypass the
   per-feature `adapters/http/routes.ts` pattern. An agent copying `residents`
   never learns some routes live inline.
3. **"Copy `residents` exactly" is prose, not a scaffold**, and the
   "every feature has domain/data/ui" rule has undocumented exceptions
   (`session`, `resident-home`).
4. **Nothing forces a feature change to carry a spec.** The brainstorm convention
   is followed by hand, not enforced.

**Goal:** one shared, documented mental model; the per-feature route pattern
enforced by lint; a scaffold + documented exceptions so new features start
correct; and a machine-checkable gate that a commit touching a feature references
a spec. Security hardening is a **separate** spec
(`2026-07-18-seguranca-hardening-design.md`) and out of scope here.

## Decisions (locked)

1. **Keep both vocabularies; document the mapping.** Web stays `domain/data/ui`,
   API stays `domain/app/adapters` — they are different concerns (UI app vs HTTP
   service). A single `docs/LAYERING.md` is the shared source of truth; the root
   `docs/ARCHITECTURE.md` points to it instead of restating the layer table.
2. **All routes live in a feature's `adapters/http/routes.ts`.** `compose.ts`
   only constructs repositories and wires (`api.route(...)`, `.use(...)`). Role
   guards move **into** each feature router, per-route.
3. **Regression is lint-enforced, not convention.** A `no-restricted-syntax`
   ESLint rule scoped to `apps/api/src/compose.ts` forbids
   `app.get/post/put/patch/delete/on(...)`; only `.route()` and `.use()` pass.
4. **Feature scaffold is plain Node + in-repo templates** (`make new-feature`).
   No new tooling dependency (no plop/hygen). It generates the reference
   structure with **failing tests already in place** (RED).
5. **The scaffold requires an existing spec path** (`spec=<path>`), tying feature
   creation to a design doc.
6. **Documented layer exceptions.** `LAYERING.md` lists the only features allowed
   to omit layers: `session` (no `data` — no repository) and `resident-home`
   (`ui` only — a composed screen). Any new feature needs the full set.
7. **Spec gate at `commit-msg`, with a conscious escape hatch.** A commit whose
   staged files touch `apps/*/src/<feature>/**` must carry a `Spec:` trailer:
   either a path under `docs/superpowers/specs/` that **exists**, or
   `Spec: none — <reason>` for trivial/refactor/dependency changes. Missing or
   invalid trailer ⇒ commit rejected. A pre-push backstop re-checks the pushed
   range. The escape hatch is kept so trivial fixes don't train agents to bypass
   the gate, and every skip is greppable (`grep "Spec: none"`).

## Design

### A. `docs/LAYERING.md` — the shared contract

New doc; the single mental model both apps share. Core table:

| Concern                                                 | Web (`apps/web`)             | API (`apps/api`)             | Import rule                                  |
| ------------------------------------------------------- | ---------------------------- | ---------------------------- | -------------------------------------------- |
| Pure core (zod entities, use cases, interfaces, errors) | `features/*/domain`          | `*/domain`                   | only `zod` + own/other domain + `shared/lib` |
| Use-case orchestration                                  | inside `domain` + `ui` hooks | `*/app`                      | no framework / driver                        |
| External impls (HTTP client, Postgres, mappers)         | `features/*/data`            | `*/adapters/{http,postgres}` | zod-parse at the boundary                    |
| Delivery / UI                                           | `features/*/ui`              | `*/adapters/http` (routes)   | —                                            |
| Composition / wiring                                    | `app/`                       | `compose.ts`                 | may import everything; **holds no logic**    |

Includes: the dependency-direction rule (`ui/adapters → app → domain`), the
"mapper parses at the boundary" rule, and the **exceptions list** (`session`,
`resident-home`). The root `docs/ARCHITECTURE.md` gets a one-line pointer to
`LAYERING.md` instead of restating the layer table.

### B. De-drift `compose.ts`

Move each inline route into its feature router, applying guards per-route inside
the router (Hono middleware composes). Mapping of the current inline routes:

| Inline route today                                                | Moves to                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `POST /auth/login`                                                | `users/adapters/http/auth-routes.ts` (new, mounted at `/auth`) |
| `POST /users`, `GET/POST /residents/:id/login*`                   | `users/adapters/http/routes.ts`                                |
| `GET /residents/me`                                               | `residents/adapters/http/routes.ts` (resident-scoped)          |
| `POST/PUT /receipts`, `:id/confirm`, `:id/reject`, `ensure-month` | `receipts/adapters/http/routes.ts`                             |
| `GET /apartments/:id/receipts`, `/apartments/:id/residents`       | `receipts` / `residents` routers (admin-guarded)               |

After the move, `compose.ts` is: build repos → construct routers with deps →
`api.use(authMiddleware)` + the active-resident middleware → `api.route(...)` per
feature. Cross-cutting middleware (auth, active-resident check) stays in
`compose.ts` — it is wiring, not feature logic.

**Guard placement inside routers:** each router receives no role from the client;
it reads `c.get('role')`/`c.get('sub')` (already set by `authMiddleware`) and
applies `requireRole('admin')` on admin-only routes and the existing
`denyForeign*` checks on resident-scoped ones. Behaviour is identical to today;
only the file location changes.

**Lint guard** (`apps/api/eslint.config.cjs`): add an override scoped to
`src/compose.ts`:

```js
{
  files: ['src/compose.ts'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector:
        "CallExpression[callee.property.name=/^(get|post|put|patch|delete|on)$/]",
      message: 'Define routes in a feature adapters/http router; compose.ts only wires (.route/.use).',
    }],
  },
}
```

### C. `make new-feature` scaffold + templates

- Templates live in `scripts/feature-templates/{web,api}/` mirroring the
  `residents` reference feature, with `__feature__`/`__Feature__` placeholders.
- `make new-feature name=<x> app=<web|api> spec=<path>`:
  - fails if `spec` is missing or the file does not exist under
    `docs/superpowers/specs/`;
  - fails if the target feature dir already exists;
  - generates the full layer set (`domain` schema+interface+error, `data`/adapter
    with mapper, `ui`/`http` route) **plus failing tests** (RED) so the agent
    fills implementation, never invents structure;
  - prints the next-step checklist (implement domain → data → ui, TDD).
- Node-only (`node scripts/new-feature.mjs`), no new dependency.

### D. Spec gate

- **Script** `scripts/check-spec-trailer.mjs`:
  - input: a commit message file (commit-msg mode) or a commit range (pre-push
    mode);
  - computes touched paths (`git diff --cached --name-only` at commit-msg; range
    diff at pre-push);
  - if any touched path matches `apps/(web|api)/src/[^/]+/` **excluding**
    `shared/`, `platform/`, `app/`, `test/`, `test-support/`, and non-source
    files, require a `Spec:` trailer:
    - `Spec: docs/superpowers/specs/<file>.md` → the file must exist, else fail;
    - `Spec: none — <reason>` → allowed, `<reason>` must be non-empty;
  - clear failure message naming the offending files and the two valid trailer
    forms.
- **lefthook** `commit-msg`: run the script in commit-msg mode (immediate,
  per-commit). **pre-push**: run it in range mode over `{push}..HEAD` as a
  backstop.
- **`make spec-index`** → generates `docs/superpowers/INDEX.md`: a
  feature ↔ specs table derived from `Spec:` trailers in git history, so the
  evolution of each feature's specs is visible in one place. Regenerated on
  demand (not a gate).
- **Docs:** `WORKFLOW.md` and root `CLAUDE.md` state the rule in prose; the
  script is the teeth.

## What does not change

- The existing boundaries configs (only the API gets the `compose.ts` override
  added), TS strict settings, coverage thresholds, commitlint, prettier.
- Any runtime behaviour of the API — routes keep identical paths, guards, and
  responses; only their file location changes.
- The web app's structure and the `residents` reference feature.
- Auth, IDOR scoping, and every security control (covered by the separate
  security spec).

## Testing (TDD)

- **B (routes moved):** the existing `apps/api/src/compose.test.ts` HTTP-level
  suite is the safety net — it must stay green through the move (same paths,
  same admin/resident 200/403/401 expectations). The `compose.ts` lint rule
  needs no unit test: `make api-lint` on a deliberate stray `app.get(...)` is
  run during development to confirm it errors, then reverted.
- **C (scaffold):** a test for `new-feature.mjs` — given a name + existing spec,
  it writes the expected files and refuses when the spec path is missing or the
  dir exists. Generated features' RED tests are asserted to fail before impl.
- **D (spec gate):** unit tests for `check-spec-trailer.mjs` — feature-touching
  diff without trailer fails; with a valid existing spec path passes; with a
  non-existent spec path fails; with `Spec: none — reason` passes; a
  shared/platform-only diff passes without a trailer.

## Out of scope

- Security hardening (rate-limit, httpOnly cookie, security headers, per-resident
  notice dismissal, dependency bump, seed guard) — separate spec.
- Unifying the two apps into one layer vocabulary (explicitly rejected).
- Any CI/GitHub-Actions gate beyond the local lefthook stages (may be added later
  to mirror the same scripts).
- Backfilling `INDEX.md` history for commits predating the trailer convention
  (the index starts from adoption forward).
