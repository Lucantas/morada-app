# Arquitetura — pendências de enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three remaining architecture-enforcement gaps: run the spec-trailer gate in CI, give the web scaffold the same repository-interface parity as the API scaffold, and fix the stale lint-selector snippet in the architecture plan doc.

**Architecture:** Pure tooling/docs — no app feature code. The spec-gate script (`scripts/check-spec-trailer.mjs`) already supports `--range` and is unit-tested; CI just needs a job that computes the right range per event. Scaffold templates live in `scripts/feature-templates/`; script tests run with `node --test`.

**Tech Stack:** GitHub Actions, Node 22 (`node:test`), plain `.mjs` scripts.

## Global Constraints

- These paths (`scripts/**`, `.github/**`, `docs/**`) are NOT feature paths — the spec trailer is optional (safe to include: `Spec: none — tooling/docs, no feature behavior`).
- Conventional commits, small and atomic. Never `--no-verify`.
- No `console.*` rule applies to app code only; scripts already use `console.error` for CLI output — matching that is fine.
- Script tests run with `node --test scripts/<file>.test.mjs`.

---

## Task 1: Spec-gate no CI

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `node scripts/check-spec-trailer.mjs --range <base>..HEAD` (exits 1 with `[spec-gate] …` on stderr when a commit in the range touches feature paths without a valid trailer; exits 0 otherwise). Pure Node, no pnpm install needed.

**Range per event:**

- `pull_request`: `${{ github.event.pull_request.base.sha }}..HEAD`
- `push` (only `main` triggers): `${{ github.event.before }}..HEAD`; when `before` is the all-zeros SHA (branch creation/force edge), skip with a notice rather than fail.

- [ ] **Step 1: Add the job** to `.github/workflows/ci.yml` (alongside `web` and `api`):

```yaml
spec-gate:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - name: Check spec trailers on every commit in range
      env:
        EVENT_NAME: ${{ github.event_name }}
        PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
        PUSH_BEFORE_SHA: ${{ github.event.before }}
      run: |
        if [ "$EVENT_NAME" = "pull_request" ]; then
          RANGE="$PR_BASE_SHA..HEAD"
        else
          case "$PUSH_BEFORE_SHA" in
            ''|0000000000000000000000000000000000000000)
              echo "No previous SHA for this push; skipping spec-gate."
              exit 0
              ;;
          esac
          RANGE="$PUSH_BEFORE_SHA..HEAD"
        fi
        echo "spec-gate range: $RANGE"
        node scripts/check-spec-trailer.mjs --range "$RANGE"
```

- [ ] **Step 2: Validate locally** — the workflow can't run locally, but the command it wraps can:

Run: `node scripts/check-spec-trailer.mjs --range origin/main~5..origin/main && echo GATE-OK`
Expected: `GATE-OK` (recent main commits all carry valid trailers). Also validate YAML: `node -e "console.log('yaml parse skipped')"` is NOT enough — use `pnpm dlx yaml-lint .github/workflows/ci.yml` OR simply `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'))" && echo YAML-OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the spec-trailer gate on every push and pull request"
```

---

## Task 2: Paridade do scaffold web — repository interface

**Files:**

- Create: `scripts/feature-templates/web/domain/__feature__-repository.ts.tmpl`
- Modify: `scripts/new-feature.mjs` (WEB_TEMPLATES)
- Modify: `scripts/feature-templates/web/data/http-__feature__-repository.ts.tmpl` (conform to the interface)
- Test: `scripts/new-feature.test.mjs`

**Interfaces:**

- Produces: web scaffold emits `domain/<feature>-repository.ts` (interface) exactly like the API scaffold; the data template's factory return is typed by that interface.

- [ ] **Step 1: Write the failing test** — in `scripts/new-feature.test.mjs`, extend the web planFiles expectation (read the existing `planFiles maps …` tests and mirror their exact style) to require `domain/__feature__-repository.ts` in the web plan:

```js
test('planFiles includes the web repository interface', () => {
  const files = planFiles('web', 'water-bill');
  assert.ok(files.some(([, out]) => out.endsWith('domain/water-bill-repository.ts')));
});
```

(Adapt to the real `planFiles` signature/return shape — read the existing tests first; the assertion intent is fixed: the web plan must contain the domain repository interface output path.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/new-feature.test.mjs`
Expected: FAIL — WEB_TEMPLATES has no repository entry.

- [ ] **Step 3: Create the template** `scripts/feature-templates/web/domain/__feature__-repository.ts.tmpl` (mirrors the API one):

```ts
import type { __Feature__ } from './__feature__';

export interface __Feature__Repository {
  list(): Promise<__Feature__[]>;
}
```

- [ ] **Step 4: Wire it** — in `scripts/new-feature.mjs` add to `WEB_TEMPLATES` (after the domain entries, before `data/`):

```js
  ['domain/__feature__-repository.ts.tmpl', 'domain/__feature__-repository.ts'],
```

- [ ] **Step 5: Conform the data template** — `scripts/feature-templates/web/data/http-__feature__-repository.ts.tmpl` types its return by the interface (a factory function can't use `implements`; typing the return achieves conformance):

```ts
import type { ApiClient } from '@/shared/lib/api-client';

import { __feature__ListSchema, type __Feature__ } from '../domain/__feature__';
import type { __Feature__Repository } from '../domain/__feature__-repository';

export function http__Feature__Repository(api: ApiClient): __Feature__Repository {
  return {
    async list(): Promise<__Feature__[]> {
      return __feature__ListSchema.parse(await api.get('/api/__feature__'));
    },
  };
}
```

- [ ] **Step 6: Run tests + a real scaffold smoke**

Run: `node --test scripts/new-feature.test.mjs` → PASS.
Smoke: `make new-feature app=web name=smoke-parity spec=docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md` → confirm `apps/web/src/features/smoke-parity/domain/smoke-parity-repository.ts` exists and `pnpm --filter @morada/web typecheck` still passes with the generated feature in place. Then DELETE the generated `apps/web/src/features/smoke-parity/` directory entirely (it was only a smoke) and re-run `pnpm --filter @morada/web typecheck` to confirm clean.

- [ ] **Step 7: Commit** (only scripts files — the smoke feature must NOT be committed):

```bash
git add scripts/feature-templates/web/domain/__feature__-repository.ts.tmpl scripts/feature-templates/web/data/http-__feature__-repository.ts.tmpl scripts/new-feature.mjs scripts/new-feature.test.mjs
git commit -m "feat(scaffold): generate the web repository interface like the api scaffold"
```

---

## Task 3: Doc accuracy — lint selector snippet

**Files:**

- Modify: `docs/superpowers/plans/2026-07-18-arquitetura-enforcement.md` (~line 1248, Task B6 snippet)

- [ ] **Step 1: Fix the snippet** — the doc shows:

```
selector: "CallExpression[callee.property.name=/^(get|post|put|patch|delete|on)$/]",
```

The shipped rule (`apps/api/eslint.config.cjs:80`, source of truth — do NOT touch it) is:

```
selector: "CallExpression[callee.object.name!='c'][callee.property.name=/^(get|post|put|patch|delete|all|on)$/]",
```

Replace the doc snippet with the shipped selector (adds `[callee.object.name!='c']` and `all`).

- [ ] **Step 2: Verify** — `grep -n "callee.object.name" docs/superpowers/plans/2026-07-18-arquitetura-enforcement.md` shows the fixed line; `diff <(grep -o "callee.*" docs/superpowers/plans/2026-07-18-arquitetura-enforcement.md | head -1) <(grep -o "callee.*" apps/api/eslint.config.cjs | head -1)` — selectors match.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-18-arquitetura-enforcement.md
git commit -m "docs: align the compose route-free lint snippet with the shipped rule"
```

---

## Self-Review

- Coverage: item #4 → Task 1; #5 → Task 2; #6 → Task 3. Complete.
- Types: `planFiles('web', …)` signature must be confirmed against the real test file by the Task 2 implementer (flagged in-step).
- No placeholders: all code/commands given verbatim.
