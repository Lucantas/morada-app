# Architecture & enforcement hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both apps one documented layering contract, enforce the per-feature route pattern by lint, ship a feature scaffold, and add a machine-checkable gate that a feature-touching commit references a spec.

**Architecture:** Four independent components implemented in order **D → A → C → B**: the spec gate (D) and layering contract (A) are low-risk and start protecting the rest; the scaffold (C) builds on them; the `compose.ts` de-drift (B) is the most invasive and is protected by the already-green `apps/api/src/compose.test.ts` HTTP suite. Behaviour of the running API does not change — only file locations and enforcement.

**Tech Stack:** Node ESM scripts (`.mjs`), lefthook, ESLint flat config (`eslint-plugin-boundaries` + `no-restricted-syntax`), Hono, Jest (ts-jest), pnpm workspaces, Makefile.

## Global Constraints

- Package manager is **pnpm** only — never npm/yarn. Run web scripts as `pnpm --filter @morada/web <script>`, API as `pnpm --filter @morada/api <script>`, or via the Makefile.
- **TDD:** failing test before implementation, in the same commit. Coverage ≥ 80% (pre-push gate); domain near 100%.
- **No `any`, no non-null assertions, no `console.*`** in app/src code — lint errors. (Node scripts under `scripts/` are outside the app tsconfig/eslint app-rules; they may use `console` for CLI output.)
- **Immutability:** never mutate inputs; return new objects/arrays.
- **No comments** unless extremely necessary.
- **Conventional commits**, small and atomic. **Never `--no-verify`.** If a gate is wrong, fix the gate in its own commit.
- Prettier check is a pre-commit gate — run `pnpm prettier --write <files>` before committing new/edited files.
- **Spec trailer (becomes mandatory after Task D2):** any commit whose staged files touch a feature path (`apps/web/src/features/<x>/**` or `apps/api/src/<x>/**`, excluding `shared`/`platform`/`app`/`test`/`test-support` and top-level `apps/api/src/*.ts`) must carry a trailer line `Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md` (or `Spec: none — <reason>`). The B tasks touch feature paths and MUST use the spec-path trailer — this dogfoods the gate.
- Reference feature: `residents`. Reference spec: `docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md`.

---

## Component D — Spec gate

### Task D1: `check-spec-trailer.mjs` — the gate logic + tests

**Files:**

- Create: `scripts/check-spec-trailer.mjs`
- Create: `scripts/check-spec-trailer.test.mjs`

**Interfaces:**

- Produces: an exported pure function `evaluateSpecTrailer({ touchedPaths, message, specExists })` returning `{ ok: boolean, reason: string }`, where `touchedPaths: string[]`, `message: string` (full commit message), `specExists: (path: string) => boolean`. The CLI wrapper (added in D2 usage) supplies real git data; the pure core is what tests target.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-spec-trailer.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSpecTrailer, isFeaturePath } from './check-spec-trailer.mjs';

const specExistsTrue = () => true;
const specExistsFalse = () => false;

test('isFeaturePath matches api and web feature dirs, excludes infra', () => {
  assert.equal(isFeaturePath('apps/api/src/receipts/app/pay-receipt.ts'), true);
  assert.equal(isFeaturePath('apps/web/src/features/residents/ui/x.tsx'), true);
  assert.equal(isFeaturePath('apps/api/src/shared/domain/iso-date.ts'), false);
  assert.equal(isFeaturePath('apps/api/src/platform/auth.ts'), false);
  assert.equal(isFeaturePath('apps/api/src/compose.ts'), false);
  assert.equal(isFeaturePath('apps/web/src/app/router.tsx'), false);
  assert.equal(isFeaturePath('docs/x.md'), false);
});

test('no feature paths → ok without trailer', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['docs/x.md', 'apps/api/src/platform/auth.ts'],
    message: 'chore: tidy',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, true);
});

test('feature path without trailer → fail', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'feat: pay',
    specExists: specExistsTrue,
  });
  assert.equal(r.ok, false);
});

test('feature path with existing spec path → ok', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'feat: pay\n\nSpec: docs/superpowers/specs/x-design.md',
    specExists: specExistsTrue,
  });
  assert.equal(r.ok, true);
});

test('feature path with non-existent spec path → fail', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'feat: pay\n\nSpec: docs/superpowers/specs/missing.md',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, false);
});

test('feature path with "none — reason" escape hatch → ok', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'fix: typo\n\nSpec: none — one-line copy fix',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, true);
});

test('"none" with empty reason → fail', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'fix: x\n\nSpec: none',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/check-spec-trailer.test.mjs`
Expected: FAIL — `Cannot find module './check-spec-trailer.mjs'` / export missing.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/check-spec-trailer.mjs`:

```js
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FEATURE_PATTERNS = [
  /^apps\/web\/src\/features\/[^/]+\//,
  /^apps\/api\/src\/(?!shared\/|platform\/|test-support\/)[^/]+\//,
];
const INFRA_API_TOP_LEVEL = /^apps\/api\/src\/[^/]+\.ts$/;
const WEB_NON_FEATURE = /^apps\/web\/src\/(app|shared|test)\//;

export function isFeaturePath(path) {
  if (INFRA_API_TOP_LEVEL.test(path)) return false;
  if (WEB_NON_FEATURE.test(path)) return false;
  return FEATURE_PATTERNS.some((re) => re.test(path));
}

function readSpecTrailer(message) {
  const match = message.match(/^Spec:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

export function evaluateSpecTrailer({ touchedPaths, message, specExists }) {
  const featureFiles = touchedPaths.filter(isFeaturePath);
  if (featureFiles.length === 0) return { ok: true, reason: 'no feature paths touched' };

  const trailer = readSpecTrailer(message);
  if (!trailer) {
    return {
      ok: false,
      reason:
        `Commit touches feature paths:\n  ${featureFiles.join('\n  ')}\n` +
        `Add a trailer: "Spec: docs/superpowers/specs/<file>.md" or "Spec: none — <reason>".`,
    };
  }
  const none = trailer.match(/^none\s*[—-]\s*(.+)$/);
  if (none) {
    return none[1].trim().length > 0
      ? { ok: true, reason: 'escape hatch with reason' }
      : { ok: false, reason: 'Spec: none requires a reason ("none — <reason>").' };
  }
  if (!specExists(trailer)) {
    return { ok: false, reason: `Spec file not found: ${trailer}` };
  }
  return { ok: true, reason: 'valid spec path' };
}

function gitTouchedPathsForMessageMode() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function gitTouchedPathsForRange(range) {
  const out = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function readMessageFile(path) {
  return execFileSync('cat', [path], { encoding: 'utf8' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  let touchedPaths;
  let message;
  if (mode === '--commit-msg') {
    message = readMessageFile(process.argv[3]);
    touchedPaths = gitTouchedPathsForMessageMode();
  } else if (mode === '--range') {
    const range = process.argv[3];
    touchedPaths = gitTouchedPathsForRange(range);
    message = execFileSync('git', ['log', '--format=%B', range], { encoding: 'utf8' });
  } else {
    console.error('usage: check-spec-trailer.mjs --commit-msg <file> | --range <range>');
    process.exit(2);
  }
  const result = evaluateSpecTrailer({
    touchedPaths,
    message,
    specExists: (p) => existsSync(p),
  });
  if (!result.ok) {
    console.error(`\n[spec-gate] ${result.reason}\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/check-spec-trailer.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Format and commit**

```bash
pnpm prettier --write scripts/check-spec-trailer.mjs scripts/check-spec-trailer.test.mjs
git add scripts/check-spec-trailer.mjs scripts/check-spec-trailer.test.mjs
git commit -m "feat(gate): spec-trailer evaluator with tests"
```

Note: `scripts/` is not a feature path — no `Spec:` trailer required for this commit.

---

### Task D2: Wire the spec gate into lefthook + Makefile

**Files:**

- Modify: `lefthook.yml` (add `commit-msg` command + `pre-push` command)
- Modify: `Makefile` (add `spec-gate` convenience target)

**Interfaces:**

- Consumes: `scripts/check-spec-trailer.mjs` `--commit-msg` / `--range` CLI from D1.

- [ ] **Step 1: Add the commit-msg command to `lefthook.yml`**

Under the existing `commit-msg:` block (which already has `commitlint`), add a sibling command:

```yaml
commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}
    spec-gate:
      run: node scripts/check-spec-trailer.mjs --commit-msg {1}
```

- [ ] **Step 2: Add the pre-push backstop to `lefthook.yml`**

Under the existing `pre-push:` block, add:

```yaml
spec-gate:
  run: node scripts/check-spec-trailer.mjs --range origin/main..HEAD
```

- [ ] **Step 3: Add a Makefile target**

Append to `Makefile`:

```makefile
spec-gate: ## Check the pushed range for spec trailers
	node scripts/check-spec-trailer.mjs --range origin/main..HEAD
```

- [ ] **Step 4: Reinstall hooks and verify the gate blocks + allows**

Run: `pnpm lefthook install`
Manual verification (do not leave test commits):

```bash
# Should FAIL (feature path, no trailer):
printf 'x\n' >> apps/api/src/receipts/domain/receipt.ts
git add apps/api/src/receipts/domain/receipt.ts
git commit -m "test: should be blocked" || echo "BLOCKED as expected"
git restore --staged apps/api/src/receipts/domain/receipt.ts
git checkout -- apps/api/src/receipts/domain/receipt.ts
```

Expected: commit rejected with `[spec-gate]` message.

- [ ] **Step 5: Commit the wiring**

```bash
pnpm prettier --write lefthook.yml
git add lefthook.yml Makefile
git commit -m "feat(gate): enforce spec trailer at commit-msg and pre-push"
```

Note: `lefthook.yml`/`Makefile` are not feature paths — no trailer required. From this commit on, feature-touching commits need the trailer.

---

### Task D3: `make spec-index` — feature ↔ spec traceability

**Files:**

- Create: `scripts/build-spec-index.mjs`
- Create: `scripts/build-spec-index.test.mjs`
- Modify: `Makefile` (add `spec-index` target)
- Create: `docs/superpowers/INDEX.md` (generated output, committed)

**Interfaces:**

- Produces: exported `buildIndex(commits)` where `commits: { subject: string, spec: string|null, files: string[] }[]` → returns a markdown string with a `feature | specs` table. Feature key derived from `isFeaturePath` file → feature name.

- [ ] **Step 1: Write the failing test**

Create `scripts/build-spec-index.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, featureOf } from './build-spec-index.mjs';

test('featureOf extracts feature name from api and web paths', () => {
  assert.equal(featureOf('apps/api/src/receipts/app/x.ts'), 'api/receipts');
  assert.equal(featureOf('apps/web/src/features/residents/ui/x.tsx'), 'web/residents');
  assert.equal(featureOf('apps/api/src/platform/auth.ts'), null);
});

test('buildIndex groups specs by feature', () => {
  const md = buildIndex([
    {
      subject: 'feat: pay',
      spec: 'docs/superpowers/specs/a.md',
      files: ['apps/api/src/receipts/app/x.ts'],
    },
    {
      subject: 'feat: list',
      spec: 'docs/superpowers/specs/b.md',
      files: ['apps/api/src/receipts/adapters/http/routes.ts'],
    },
  ]);
  assert.match(md, /api\/receipts/);
  assert.match(md, /a\.md/);
  assert.match(md, /b\.md/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/build-spec-index.test.mjs`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/build-spec-index.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isFeaturePath } from './check-spec-trailer.mjs';

export function featureOf(path) {
  if (!isFeaturePath(path)) return null;
  const api = path.match(/^apps\/api\/src\/([^/]+)\//);
  if (api) return `api/${api[1]}`;
  const web = path.match(/^apps\/web\/src\/features\/([^/]+)\//);
  if (web) return `web/${web[1]}`;
  return null;
}

export function buildIndex(commits) {
  const byFeature = new Map();
  for (const commit of commits) {
    if (!commit.spec || commit.spec.startsWith('none')) continue;
    const features = new Set(commit.files.map(featureOf).filter(Boolean));
    for (const feature of features) {
      const specs = byFeature.get(feature) ?? new Set();
      specs.add(commit.spec);
      byFeature.set(feature, specs);
    }
  }
  const rows = [...byFeature.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([feature, specs]) =>
        `| \`${feature}\` | ${[...specs].map((s) => `\`${s}\``).join('<br>')} |`,
    );
  return (
    '# Feature ↔ spec index\n\n' +
    '> Generated by `make spec-index`. Do not edit by hand.\n\n' +
    '| Feature | Specs |\n| --- | --- |\n' +
    rows.join('\n') +
    '\n'
  );
}

function collectCommits() {
  const raw = execFileSync('git', ['log', '--format=%x00%s%x00%b%x01', '--name-only'], {
    encoding: 'utf8',
  });
  return raw
    .split('\x01')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [, subject, rest = ''] = block.split('\x00');
      const bodyEnd = rest.indexOf('\n\n');
      const body = bodyEnd === -1 ? rest : rest.slice(0, bodyEnd);
      const files = rest
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes('/') && !l.startsWith('Spec:'));
      const specMatch = body.match(/^Spec:\s*(.+)$/m);
      return { subject, spec: specMatch ? specMatch[1].trim() : null, files };
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync('docs/superpowers/INDEX.md', buildIndex(collectCommits()));
  console.log('Wrote docs/superpowers/INDEX.md');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/build-spec-index.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Add Makefile target, generate, commit**

Append to `Makefile`:

```makefile
spec-index: ## Regenerate docs/superpowers/INDEX.md from git trailers
	node scripts/build-spec-index.mjs
```

```bash
node scripts/build-spec-index.mjs
pnpm prettier --write scripts/build-spec-index.mjs scripts/build-spec-index.test.mjs docs/superpowers/INDEX.md
git add scripts/build-spec-index.mjs scripts/build-spec-index.test.mjs docs/superpowers/INDEX.md Makefile
git commit -m "feat(gate): generate feature-to-spec index"
```

---

## Component A — Layering contract

### Task A1: `docs/LAYERING.md` + pointer from `docs/ARCHITECTURE.md`

**Files:**

- Create: `docs/LAYERING.md`
- Modify: `docs/ARCHITECTURE.md` (replace the layer table with a one-line pointer)

- [ ] **Step 1: Write `docs/LAYERING.md`**

Create `docs/LAYERING.md` with: the intro (both apps share one model, two vocabularies), the mapping table from the design spec §A (Concern / Web / API / Import rule), the dependency-direction rule `ui|adapters → app → domain`, the "mapper parses at the boundary" rule, and the **exceptions list**:

```markdown
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
```

- [ ] **Step 2: Point `docs/ARCHITECTURE.md` at it**

Replace the "Layers and allowed imports" table in `docs/ARCHITECTURE.md` with a single line:

```markdown
## Layers and allowed imports

See [LAYERING.md](./LAYERING.md) — the shared layering contract for both apps
(web `domain/data/ui` ↔ API `domain/app/adapters`), the dependency-direction
rule, and the documented layer exceptions.
```

Leave the rest of `ARCHITECTURE.md` (Key patterns, Adding a feature) intact.

- [ ] **Step 3: Format and commit**

```bash
pnpm prettier --write docs/LAYERING.md docs/ARCHITECTURE.md
git add docs/LAYERING.md docs/ARCHITECTURE.md
git commit -m "docs(arch): add shared layering contract"
```

Note: `docs/` is not a feature path — no trailer required.

---

## Component C — Feature scaffold

### Task C1: `new-feature.mjs` + API templates + Makefile target + tests

**Files:**

- Create: `scripts/new-feature.mjs`
- Create: `scripts/new-feature.test.mjs`
- Create: `scripts/feature-templates/api/domain/__feature__.ts.tmpl`
- Create: `scripts/feature-templates/api/domain/__feature__-repository.ts.tmpl`
- Create: `scripts/feature-templates/api/domain/errors.ts.tmpl`
- Create: `scripts/feature-templates/api/app/list-__feature__.ts.tmpl`
- Create: `scripts/feature-templates/api/adapters/http/routes.ts.tmpl`
- Create: `scripts/feature-templates/api/adapters/http/routes.test.ts.tmpl`
- Modify: `Makefile` (add `new-feature` target)

**Interfaces:**

- Produces: exported `render(template, name)` substituting `__feature__` → kebab name and `__Feature__` → PascalCase; and `planFiles({ app, name })` → `{ from, to }[]` mapping templates to destination paths. CLI validates `name`, `app`, and existing `spec`.

- [ ] **Step 1: Write the failing test**

Create `scripts/new-feature.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, planFiles, validate } from './new-feature.mjs';

test('render substitutes both placeholders', () => {
  const out = render('export const __feature__ = "__Feature__";', 'water-bill');
  assert.equal(out, 'export const water-bill = "WaterBill";');
});

test('planFiles maps api templates to feature dir', () => {
  const files = planFiles({ app: 'api', name: 'water' });
  assert.ok(files.some((f) => f.to === 'apps/api/src/water/domain/water.ts'));
  assert.ok(files.some((f) => f.to === 'apps/api/src/water/adapters/http/routes.ts'));
});

test('validate rejects missing spec', () => {
  assert.throws(() =>
    validate({ app: 'api', name: 'water', spec: undefined, specExists: () => false }),
  );
});

test('validate rejects non-existent spec file', () => {
  assert.throws(() =>
    validate({ app: 'api', name: 'water', spec: 'docs/x.md', specExists: () => false }),
  );
});

test('validate rejects existing feature dir', () => {
  assert.throws(() =>
    validate({
      app: 'api',
      name: 'residents',
      spec: 'docs/x.md',
      specExists: () => true,
      dirExists: () => true,
    }),
  );
});

test('validate accepts good input', () => {
  assert.doesNotThrow(() =>
    validate({
      app: 'api',
      name: 'water',
      spec: 'docs/x.md',
      specExists: () => true,
      dirExists: () => false,
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/new-feature.test.mjs`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/new-feature.mjs`:

```js
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

function pascal(name) {
  return name
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

export function render(template, name) {
  return template.replaceAll('__feature__', name).replaceAll('__Feature__', pascal(name));
}

const API_TEMPLATES = [
  ['domain/__feature__.ts.tmpl', 'domain/__feature__.ts'],
  ['domain/__feature__-repository.ts.tmpl', 'domain/__feature__-repository.ts'],
  ['domain/errors.ts.tmpl', 'domain/errors.ts'],
  ['app/list-__feature__.ts.tmpl', 'app/list-__feature__.ts'],
  ['adapters/http/routes.ts.tmpl', 'adapters/http/routes.ts'],
  ['adapters/http/routes.test.ts.tmpl', 'adapters/http/routes.test.ts'],
];

const WEB_TEMPLATES = [
  ['domain/__feature__.ts.tmpl', 'domain/__feature__.ts'],
  ['domain/__feature__.test.ts.tmpl', 'domain/__feature__.test.ts'],
  ['data/http-__feature__-repository.ts.tmpl', 'data/http-__feature__-repository.ts'],
  ['ui/use-__feature__.ts.tmpl', 'ui/use-__feature__.ts'],
  ['ui/__Feature__Screen.tsx.tmpl', 'ui/__Feature__Screen.tsx'],
];

function baseDir(app) {
  return app === 'api' ? `apps/api/src` : `apps/web/src/features`;
}

export function planFiles({ app, name }) {
  const templates = app === 'api' ? API_TEMPLATES : WEB_TEMPLATES;
  const root = `${baseDir(app)}/${name}`;
  return templates.map(([from, to]) => ({
    from: `scripts/feature-templates/${app}/${from}`,
    to: render(`${root}/${to}`, name),
  }));
}

export function validate({ app, name, spec, specExists, dirExists = existsSync }) {
  if (app !== 'api' && app !== 'web') throw new Error('app must be "api" or "web"');
  if (!/^[a-z][a-z0-9-]*$/.test(name ?? '')) throw new Error('name must be kebab-case');
  if (!spec) throw new Error('spec=<path> is required (a design doc under docs/superpowers/specs)');
  if (!specExists(spec)) throw new Error(`spec file not found: ${spec}`);
  if (dirExists(`${baseDir(app)}/${name}`)) throw new Error(`feature dir already exists: ${name}`);
}

function argOf(key) {
  const hit = process.argv.find((a) => a.startsWith(`${key}=`));
  return hit ? hit.slice(key.length + 1) : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = argOf('app');
  const name = argOf('name');
  const spec = argOf('spec');
  try {
    validate({ app, name, spec, specExists: (p) => existsSync(p) });
  } catch (error) {
    console.error(`[new-feature] ${error.message}`);
    process.exit(1);
  }
  for (const { from, to } of planFiles({ app, name })) {
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, render(readFileSync(from, 'utf8'), name));
    console.log(`created ${to}`);
  }
  console.log(
    `\nNext: implement domain → ${app === 'api' ? 'app → adapters' : 'data → ui'} (TDD). Spec: ${spec}`,
  );
}
```

- [ ] **Step 4: Create the API templates**

Create each file under `scripts/feature-templates/api/`. Model them on the `residents` feature but minimal, with a **failing test** in `routes.test.ts.tmpl`. Example `domain/__feature__.ts.tmpl`:

```ts
import { z } from 'zod';

export const __feature__Schema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
});

export type __Feature__ = z.infer<typeof __feature__Schema>;
```

`domain/__feature__-repository.ts.tmpl`:

```ts
import type { __Feature__ } from './__feature__';

export interface __Feature__Repository {
  list(): Promise<__Feature__[]>;
}
```

`domain/errors.ts.tmpl`:

```ts
export class __Feature__NotFoundError extends Error {
  constructor(id: string) {
    super(`__Feature__ ${id} not found`);
    this.name = '__Feature__NotFoundError';
  }
}
```

`app/list-__feature__.ts.tmpl`:

```ts
import type { __Feature__ } from '../domain/__feature__';
import type { __Feature__Repository } from '../domain/__feature__-repository';

export function list__Feature__(repo: __Feature__Repository): Promise<__Feature__[]> {
  return repo.list();
}
```

`adapters/http/routes.ts.tmpl`:

```ts
import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { list__Feature__ } from '../../app/list-__feature__';
import type { __Feature__Repository } from '../../domain/__feature__-repository';

export function __feature__Routes(repo: __Feature__Repository) {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await list__Feature__(repo)));
  return app;
}
```

`adapters/http/routes.test.ts.tmpl` (fails until wired — a real RED test):

```ts
import { __feature__Routes } from './routes';
import type { __Feature__Repository } from '../../domain/__feature__-repository';

test('lists __feature__ entities', async () => {
  const repo: __Feature__Repository = { list: async () => [{ id: '1', name: 'Seed' }] };
  const app = __feature__Routes(repo);
  const res = await app.request('/');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([{ id: '1', name: 'Seed' }]);
});
```

- [ ] **Step 5: Add Makefile target**

Append to `Makefile`:

```makefile
new-feature: ## Scaffold a feature: make new-feature app=api|web name=<kebab> spec=<path>
	node scripts/new-feature.mjs app=$(app) name=$(name) spec=$(spec)
```

- [ ] **Step 6: Run tests + a real scaffold smoke test**

Run: `node --test scripts/new-feature.test.mjs` → PASS.
Smoke (then discard): `make new-feature app=api name=smoke spec=docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md`, verify files created and that `pnpm --filter @morada/api exec jest src/smoke` shows a **failing** RED test, then `rm -rf apps/api/src/smoke`.

- [ ] **Step 7: Commit**

```bash
pnpm prettier --write scripts/new-feature.mjs scripts/new-feature.test.mjs
git add scripts/new-feature.mjs scripts/new-feature.test.mjs scripts/feature-templates/api Makefile
git commit -m "feat(scaffold): make new-feature for the API"
```

Note: `scripts/` is not a feature path — no trailer required.

---

### Task C2: Web templates

**Files:**

- Create: `scripts/feature-templates/web/domain/__feature__.ts.tmpl`
- Create: `scripts/feature-templates/web/domain/__feature__.test.ts.tmpl`
- Create: `scripts/feature-templates/web/data/http-__feature__-repository.ts.tmpl`
- Create: `scripts/feature-templates/web/ui/use-__feature__.ts.tmpl`
- Create: `scripts/feature-templates/web/ui/__Feature__Screen.tsx.tmpl`

**Interfaces:**

- Consumes: `WEB_TEMPLATES` list + `planFiles({ app: 'web' })` from C1.

- [ ] **Step 1: Add a failing test for the web plan**

Append to `scripts/new-feature.test.mjs`:

```js
test('planFiles maps web templates to features dir', () => {
  const files = planFiles({ app: 'web', name: 'water' });
  assert.ok(files.some((f) => f.to === 'apps/web/src/features/water/domain/water.ts'));
  assert.ok(files.some((f) => f.to === 'apps/web/src/features/water/ui/WaterScreen.tsx'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/new-feature.test.mjs`
Expected: FAIL — no web templates on disk yet; the smoke path would 404, but the plan test itself passes on paths. If it passes already (planFiles is pure), proceed to create templates so the real scaffold works.

- [ ] **Step 3: Create the web templates**

Model on the `residents` web feature. `domain/__feature__.ts.tmpl`:

```ts
import { z } from 'zod';

export const __feature__Schema = z.object({ id: z.string().min(1), name: z.string().min(1) });
export const __feature__ListSchema = z.array(__feature__Schema);
export type __Feature__ = z.infer<typeof __feature__Schema>;
```

`domain/__feature__.test.ts.tmpl` (RED — asserts a rejection the impl must satisfy):

```ts
import { __feature__Schema } from './__feature__';

test('rejects an entity without a name', () => {
  expect(() => __feature__Schema.parse({ id: '1', name: '' })).toThrow();
});
```

`data/http-__feature__-repository.ts.tmpl`:

```ts
import type { ApiClient } from '../../../shared/lib/api-client';
import { __feature__ListSchema, type __Feature__ } from '../domain/__feature__';

export function httpFeatureRepository(api: ApiClient) {
  return {
    async list(): Promise<__Feature__[]> {
      return __feature__ListSchema.parse(await api.get('/api/__feature__'));
    },
  };
}
```

`ui/use-__feature__.ts.tmpl`:

```ts
import { useQuery } from '@tanstack/react-query';

import type { __Feature__ } from '../domain/__feature__';

export function use__Feature__(list: () => Promise<__Feature__[]>) {
  return useQuery({ queryKey: ['__feature__'], queryFn: list });
}
```

`ui/__Feature__Screen.tsx.tmpl`:

```tsx
import { use__Feature__ } from './use-__feature__';
import type { __Feature__ } from '../domain/__feature__';

export function __Feature__Screen({ list }: { list: () => Promise<__Feature__[]> }) {
  const query = use__Feature__(list);
  if (query.isLoading) return <p>Carregando…</p>;
  if (query.isError) return <p>Erro ao carregar.</p>;
  return (
    <ul>
      {(query.data ?? []).map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

Adjust the `ApiClient` import/shape to the real `apps/web/src/shared/lib/api-client.ts` export (read it first; match its actual type/signature).

- [ ] **Step 4: Run tests + web smoke, then discard**

Run: `node --test scripts/new-feature.test.mjs` → PASS.
Smoke: `make new-feature app=web name=smoke spec=docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md`, verify files, run `pnpm --filter @morada/web exec jest src/features/smoke` shows the RED test failing, then `rm -rf apps/web/src/features/smoke`.

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write scripts/new-feature.test.mjs
git add scripts/feature-templates/web scripts/new-feature.test.mjs
git commit -m "feat(scaffold): web feature templates"
```

---

## Component B — De-drift `compose.ts`

> Every B task is a behaviour-preserving move. The invariant: `make api-check`
> (typecheck + lint + `compose.test.ts` and all API tests, 80% coverage) stays
> green after each task. Every B commit touches feature paths, so it MUST carry:
> `Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md`

### Task B1: Extract `POST /auth/login` → `users/adapters/http/auth-routes.ts`

**Files:**

- Create: `apps/api/src/users/adapters/http/auth-routes.ts`
- Modify: `apps/api/src/compose.ts` (remove the inline `/auth/login` handler + now-unused imports; mount the router)

**Interfaces:**

- Produces: `export function authRoutes(deps: { users; hasher; isResidentActive; })` returning `Hono` with `POST /login`. Signs the session exactly as today.
- Consumes: `signSession`, `verifyCredentials`, `InvalidCredentialsError`, `loginSchema` (move the schema into the router file).

- [ ] **Step 1: Confirm the safety net is green**

Run: `make api-test`
Expected: PASS. This is the baseline the move must preserve.

- [ ] **Step 2: Create the router**

Create `apps/api/src/users/adapters/http/auth-routes.ts` moving the logic from `compose.ts:87-95` verbatim (login schema, `verifyCredentials`, active check, `signSession`). Signature:

```ts
import { Hono } from 'hono';
import { z } from 'zod';

import { signSession, type ApiEnv } from '../../../platform/auth';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { UserRepository } from '../../domain/user-repository';
import { verifyCredentials } from '../../app/verify-credentials';
import { InvalidCredentialsError } from '../../domain/errors';

const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
});

export function authRoutes(deps: {
  users: UserRepository;
  hasher: PasswordHasher;
  isResidentActive: (residentId: string | null) => Promise<boolean>;
}) {
  const app = new Hono<ApiEnv>();
  app.post('/login', async (c) => {
    const { username, password } = loginSchema.parse(await c.req.json());
    const user = await verifyCredentials(deps.users, deps.hasher, username, password);
    if (user.role === 'resident' && !(await deps.isResidentActive(user.residentId))) {
      throw new InvalidCredentialsError();
    }
    const subject = user.role === 'resident' ? (user.residentId ?? user.id) : user.id;
    return c.json({ token: await signSession(user.role, subject), role: user.role });
  });
  return app;
}
```

Verify the exact import paths for `PasswordHasher`/`UserRepository`/`verifyCredentials` against the real `users` domain/app files before writing.

- [ ] **Step 3: Wire it in `compose.ts`, delete the inline handler**

Remove `compose.ts:87-95` and the now-unused `signSession`, `verifyCredentials`, `InvalidCredentialsError`, `loginSchema` (only if unused elsewhere — `signSession` and `verifyCredentials` are still used by other inline handlers until later tasks, so keep imports that remain referenced). Add near the app construction (before or after `/healthz`):

```ts
app.route('/auth', authRoutes({ users, hasher, isResidentActive }));
```

- [ ] **Step 4: Verify green**

Run: `make api-check`
Expected: PASS — `compose.test.ts` login tests unchanged and passing; lint clean; coverage ≥ 80%.

- [ ] **Step 5: Commit (with spec trailer)**

```bash
pnpm prettier --write apps/api/src/users/adapters/http/auth-routes.ts apps/api/src/compose.ts
git add apps/api/src/users/adapters/http/auth-routes.ts apps/api/src/compose.ts
git commit -m "refactor(api): move auth login into users adapters/http

Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md"
```

---

### Task B2: Extract `/users` + `/residents/:id/login*` → `users/adapters/http/routes.ts`

**Files:**

- Create: `apps/api/src/users/adapters/http/routes.ts`
- Modify: `apps/api/src/compose.ts`

**Interfaces:**

- Produces: `export function userRoutes(deps: { users; hasher; residents; })` with `POST /` (provision), and the login read/reset routes mounted under a path that preserves the current URLs. Because the current URLs are `/residents/:id/login` and `/residents/:id/login/reset` (admin), keep them by mounting this router pieces appropriately: put provision at `/users` and the login read/reset in the residents router in **Task B3's** file is wrong — they are user concerns. Keep the exact paths by registering them from the users router mounted at `/residents` is ambiguous. **Decision:** mount provision at `/users`; register the two login routes as `POST /users/provision`-style is a URL change — NOT allowed. Instead keep them where the URL demands: add `GET /:id/login` and `POST /:id/login/reset` to the **residents** router (Task B3), since the URL is `/residents/...`. This task moves ONLY `POST /users`.

- [ ] **Step 1: Create `users/adapters/http/routes.ts` with provision only**

Move `compose.ts:109-126` (the `/users` provision handler, admin-guarded) into:

```ts
import { Hono } from 'hono';
import { z } from 'zod';

import { requireRole, type ApiEnv } from '../../../platform/auth';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { UserRepository } from '../../domain/user-repository';
import type { ResidentRepository } from '../../../residents/domain/resident-repository';
import { createResidentLogin } from '../../app/create-resident-login';
import { generateTempPassword } from '../../../platform/temp-password';
import { usernameSchema } from '../../domain/user';

const provisionSchema = z.object({
  username: usernameSchema,
  residentId: z.string().min(1).max(64),
});

export function userRoutes(deps: {
  users: UserRepository;
  hasher: PasswordHasher;
  residents: ResidentRepository;
}) {
  const app = new Hono<ApiEnv>();
  app.post('/', requireRole('admin'), async (c) => {
    const { username, residentId } = provisionSchema.parse(await c.req.json());
    const tempPassword = generateTempPassword();
    const user = await createResidentLogin(
      deps.users,
      deps.hasher,
      async (id) => (await deps.residents.getById(id)) !== null,
      { username, password: tempPassword, residentId },
    );
    return c.json(
      { id: user.id, username: user.username, residentId: user.residentId, tempPassword },
      201,
    );
  });
  return app;
}
```

- [ ] **Step 2: Wire + delete inline**

In `compose.ts`, delete `compose.ts:109-126`, add `api.route('/users', userRoutes({ users, hasher, residents }));` and drop now-unused imports (`createResidentLogin`, `generateTempPassword`, `usernameSchema`, `provisionSchema`) if no longer referenced.

- [ ] **Step 3: Verify green**

Run: `make api-check` → PASS (`compose.test.ts` provision test unchanged).

- [ ] **Step 4: Commit**

```bash
pnpm prettier --write apps/api/src/users/adapters/http/routes.ts apps/api/src/compose.ts
git add apps/api/src/users/adapters/http/routes.ts apps/api/src/compose.ts
git commit -m "refactor(api): move user provisioning into users adapters/http

Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md"
```

---

### Task B3: Move `/residents/me` + `/residents/:id/login*` into the residents router

**Files:**

- Modify: `apps/api/src/residents/adapters/http/routes.ts` (add the three routes)
- Modify: `apps/api/src/compose.ts` (remove the three inline handlers + the `guarded('admin', …)` wrapper so the router self-guards)

**Interfaces:**

- Consumes: `residentRoutes(repo, receipts)` gains extra deps `users`, `hasher`, `resetResidentPassword`, `generateTempPassword`, `getResident`. Update the factory signature to `residentRoutes(deps: { residents; receipts; users; hasher; })`.

- [ ] **Step 1: Note the ordering constraint**

The current inline routes `GET /residents/me`, `GET /residents/:id/login`, `POST /residents/:id/login/reset` are registered **before** the admin-guarded `/residents` mount so they aren't shadowed and so `/me` is resident-accessible. Inside a single `residentRoutes` router the order is preserved by declaring `/me` and the `:id/login*` routes with their own guards **before** the generic `/:id` admin routes.

- [ ] **Step 2: Add the routes to `residents/adapters/http/routes.ts`**

Change the factory to take the deps object, add at the top of the router (before `/:id`):

```ts
// resident-accessible: own record by JWT subject
app.get('/me', async (c) => c.json(await getResident(repo, receipts, c.get('sub'))));

// admin-only: read login username / reset password (URL stays /residents/:id/login*)
app.get('/:id/login', requireRole('admin'), async (c) => {
  const user = await deps.users.findByResidentId(c.req.param('id'));
  return c.json(user ? { username: user.username } : null);
});
app.post('/:id/login/reset', requireRole('admin'), async (c) => {
  const tempPassword = generateTempPassword();
  const user = await resetResidentPassword(
    deps.users,
    deps.hasher,
    c.req.param('id'),
    tempPassword,
  );
  return c.json({ username: user.username, tempPassword });
});
```

Guard the pre-existing admin resident routes (`/`, `/:id`, `POST /`, `PUT /:id`, deactivate, status) with `requireRole('admin')` per-route (replacing the `guarded()` wrapper removed from compose). `GET /:id/login` must be declared before `GET /:id` so it isn't shadowed.

- [ ] **Step 3: Update `compose.ts`**

Delete inline `compose.ts:130-145`; change the mount from `api.route('/residents', guarded('admin', residentRoutes(residents, receipts)))` to `api.route('/residents', residentRoutes({ residents, receipts, users, hasher }))`. Remove now-unused imports (`getResident`, `resetResidentPassword`, `generateTempPassword` if unused elsewhere).

- [ ] **Step 4: Verify green**

Run: `make api-check` → PASS. Pay attention to the `/me` vs `/:id` ordering test and the admin-guard 403 tests in `compose.test.ts`.

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write apps/api/src/residents/adapters/http/routes.ts apps/api/src/compose.ts
git add apps/api/src/residents/adapters/http/routes.ts apps/api/src/compose.ts
git commit -m "refactor(api): move resident me/login routes into residents adapters/http

Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md"
```

---

### Task B4: Move receipt admin routes + `GET /apartments/:id/receipts` into the receipts router

**Files:**

- Modify: `apps/api/src/receipts/adapters/http/routes.ts`
- Modify: `apps/api/src/compose.ts`

**Interfaces:**

- Consumes: `receiptRoutes(repo)` gains deps for create/edit/confirm/reject/ensure-month + apartment ledger. New signature `receiptRoutes(deps: { receipts; residents; settings; })` (residents for `apartmentOf`, settings for monthly generation).

- [ ] **Step 1: Add the admin routes to the receipts router**

Move `compose.ts:167-210` into `receipts/adapters/http/routes.ts`, each with `requireRole('admin')`, declared **before** the existing `/:id` resident routes where a path collision exists (e.g. `POST /` vs none; `PUT /:id`, `POST /:id/confirm`, `POST /:id/reject` must precede the generic resident `/:id/*`; `POST /ensure-month` and `GET /apartments/...` are distinct paths). Use the same use-case calls (`createReceipt`, `editReceipt`, `confirmPayment`, `rejectPayment`, `generateMonthlyReceipts`, `repo.listByApartment`). `apartmentOf` comes from `deps.residents.apartmentOf`.

- [ ] **Step 2: Update `compose.ts`**

Delete inline `compose.ts:167-210`; change the mount to `api.route('/receipts', receiptRoutes({ receipts, residents, settings }))`. `GET /apartments/:id/receipts` moves under the receipts router only if the URL can stay `/apartments/...`; since the router is mounted at `/receipts`, keep `/apartments/:id/receipts` as a **separate** small mount: create `apartmentRoutes(deps)` OR keep it as the one inline exception is NOT allowed (lint). **Decision:** add an `apartments` mount: `api.route('/apartments', apartmentReceiptRoutes({ receipts, residents }))` exposing `GET /:id/receipts` (this task) and `GET /:id/residents` (Task B5).

- [ ] **Step 3: Create `apartments` router**

Create `apps/api/src/receipts/adapters/http/apartment-routes.ts` (apartment ledger is a receipts read) with `GET /:id/receipts` admin-guarded calling `repo.listByApartment`. (B5 adds `/:id/residents` from the residents side — mount both under `/apartments` by having compose combine them, or give the residents router its own `/apartments/:id/residents`; see B5.)

- [ ] **Step 4: Verify green**

Run: `make api-check` → PASS.

- [ ] **Step 5: Commit**

```bash
pnpm prettier --write apps/api/src/receipts/adapters/http/routes.ts apps/api/src/receipts/adapters/http/apartment-routes.ts apps/api/src/compose.ts
git add apps/api/src/receipts/adapters/http apps/api/src/compose.ts
git commit -m "refactor(api): move receipt admin + apartment ledger routes into receipts adapters/http

Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md"
```

---

### Task B5: Move `GET /apartments/:id/residents` into the residents adapter

**Files:**

- Modify: `apps/api/src/residents/adapters/http/routes.ts` (or a sibling `apartment-residents-routes.ts`)
- Modify: `apps/api/src/compose.ts`

- [ ] **Step 1: Expose the apartment-residents route**

Move `compose.ts:214-216` (`GET /apartments/:id/residents`, admin) into a small router `apartmentResidentRoutes({ residents })` in `residents/adapters/http/apartment-routes.ts` with `GET /:id/residents` admin-guarded calling `residents.listByApartment`.

- [ ] **Step 2: Combine under `/apartments` in compose**

Mount both apartment routers so the URLs stay `/apartments/:id/receipts` and `/apartments/:id/residents`:

```ts
const apartments = new Hono<ApiEnv>();
apartments.route('/', apartmentReceiptRoutes({ receipts }));
apartments.route('/', apartmentResidentRoutes({ residents }));
api.route('/apartments', apartments);
```

(This `new Hono()` + `.route()` composition in compose is wiring, allowed by the lint rule — only `.get/.post/...` are forbidden there.)

Delete the inline `compose.ts:208-216` block.

- [ ] **Step 3: Verify green**

Run: `make api-check` → PASS.

- [ ] **Step 4: Commit**

```bash
pnpm prettier --write apps/api/src/residents/adapters/http/apartment-routes.ts apps/api/src/compose.ts
git add apps/api/src/residents/adapters/http apps/api/src/compose.ts
git commit -m "refactor(api): move apartment residents route into residents adapters/http

Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md"
```

---

### Task B6: Add the `compose.ts` lint guard + final verification

**Files:**

- Modify: `apps/api/eslint.config.cjs` (add the scoped `no-restricted-syntax` override)

**Interfaces:**

- Consumes: a `compose.ts` that now contains **no** `app.get/post/put/patch/delete/on(...)` calls (verified by B1–B5).

- [ ] **Step 1: Confirm compose is clean**

Run: `grep -nE '\.(get|post|put|patch|delete|on)\(' apps/api/src/compose.ts`
Expected: no route-definition matches (only `.route(...)`, `.use(...)`, `.onError(...)`). `onError` is not in the forbidden list; if any `app.on(...)` remains (e.g. `api.on('POST', '/notices', requireRole('admin'))`), convert those guards into the relevant feature router first (notices/threads admin guards) so the rule can pass.

- [ ] **Step 2: Handle the remaining `api.on(...)` guards**

`compose.ts` still has `api.on('POST', '/notices', …)`, `api.on('DELETE', '/notices/*', …)`, `api.on('GET', '/threads', …)`. Move these admin guards into the `noticeRoutes`/`threadRoutes` routers (apply `requireRole('admin')` per-route inside those routers on create/delete and thread-list), then delete the `api.on(...)` lines. Verify `make api-check` green after.

- [ ] **Step 3: Add the lint override**

In `apps/api/eslint.config.cjs`, add:

```js
{
  files: ['src/compose.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name=/^(get|post|put|patch|delete|on)$/]",
        message:
          'Define routes in a feature adapters/http router; compose.ts only wires (.route/.use).',
      },
    ],
  },
},
```

- [ ] **Step 4: Verify the rule passes now and fails on a violation**

Run: `make api-lint` → PASS (compose is clean).
Temporarily add `app.get('/x', (c) => c.json({}));` to `compose.ts`, run `make api-lint` → FAIL with the message, then remove it.

- [ ] **Step 5: Full gate + commit**

Run: `make api-check` → PASS.

```bash
pnpm prettier --write apps/api/eslint.config.cjs apps/api/src/compose.ts apps/api/src/notices/adapters/http/routes.ts apps/api/src/messages/adapters/http/routes.ts
git add apps/api/eslint.config.cjs apps/api/src/compose.ts apps/api/src/notices apps/api/src/messages
git commit -m "feat(api): forbid inline routes in compose.ts via lint

Spec: docs/superpowers/specs/2026-07-18-arquitetura-enforcement-design.md"
```

- [ ] **Step 6: Regenerate the spec index**

Run: `make spec-index` then commit `docs/superpowers/INDEX.md` (now populated by the B-task trailers):

```bash
pnpm prettier --write docs/superpowers/INDEX.md
git add docs/superpowers/INDEX.md
git commit -m "docs(gate): refresh feature-to-spec index"
```

---

## Self-Review

**Spec coverage:**

- Design §A (LAYERING.md + pointer) → Task A1. ✓
- Design §B (routes → adapters/http; compose only wires; lint rule) → Tasks B1–B6. ✓
- Design §C (Node scaffold, RED tests, spec-required, exceptions doc) → Tasks C1–C2 (scaffold) + A1 (exceptions list). ✓
- Design §D (check-spec-trailer at commit-msg + pre-push; trailer forms + escape hatch; spec-index) → Tasks D1–D3. ✓
- "Behaviour does not change" → every B task gates on `make api-check` + `compose.test.ts`. ✓

**Placeholder scan:** No "TBD/TODO". The B tasks reference exact `compose.ts` line ranges and exact use-case names to move; C templates give full file bodies; D gives full script bodies. Two spots instruct "verify the real import path/`ApiClient` shape before writing" — these are correctness guards (read the actual file), not placeholders.

**Type consistency:** `evaluateSpecTrailer`/`isFeaturePath` (D1) reused by `build-spec-index.mjs` (D3) and by name in tests. `render`/`planFiles`/`validate` (C1) reused by C2's added test. `authRoutes`/`userRoutes`/`residentRoutes(deps)`/`receiptRoutes(deps)` factory signatures are stated where introduced and consumed in compose wiring. Placeholder tokens `__feature__`/`__Feature__` consistent across all templates and `render`.

**Known follow-ups (not gaps):** B2/B3 carry an explicit **Decision** note resolving where the `/residents/:id/login*` URLs live (residents router, because the URL is `/residents/...`) — the executor must honor the stated URL-preservation decision, not split it by concern.
