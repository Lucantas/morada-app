# Loading Skeletons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every "Carregando…" text/spinner loading state on the 14 active logged-in screens (admin + resident) with shimmer skeletons that mirror the real content layout.

**Architecture:** One reusable primitive module `shared/ui/skeleton.tsx` (`Skeleton`, `SkeletonScreen`, `SkeletonRows`, `SkeletonField`, `SkeletonButton`) plus shimmer CSS in `tokens.css`. Each screen gets a co-located `*-skeleton.tsx` that composes the primitives into the shape of its content, wired in place of the current `isLoading` branch. Error and empty states are untouched.

**Tech Stack:** Vite + React 19, TypeScript strict, Jest (ts-jest) + Testing Library + jsdom, TanStack Query.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-22-loading-skeletons-design.md` — put this as a `Spec:` trailer on every commit.
- TDD: failing test before implementation, in the same commit. Never `--no-verify`.
- Coverage ≥ 80% (pre-push gate). No `any`, no non-null assertions (`!`), no `console.*` — lint errors. `as unknown as T` casts are allowed.
- Immutability; comments only when extremely necessary.
- Boundaries `ui → domain ← data`: skeleton primitives live in `shared/ui`; per-screen skeletons in `features/<feature>/ui`. No imports from `domain`/`data` inside skeleton components.
- Conventional commits, small and atomic. Type `feat` for user-facing screens, `feat`/`refactor` sensible per change.
- Run the full web gate before finishing: `make check`.
- Single-file test run: `pnpm --filter @morada/web test -- <relative-path-from-apps/web>`.
- Work on branch `feat/loading-skeletons` (already created; the spec commit is its first commit).

---

### Task 1: Skeleton primitives + shimmer CSS

**Files:**

- Create: `apps/web/src/shared/ui/skeleton.tsx`
- Modify: `apps/web/src/shared/ui/tokens.css` (append shimmer + visually-hidden CSS)
- Test: `apps/web/src/shared/ui/skeleton.test.tsx`

**Interfaces:**

- Produces:
  - `Skeleton(props: { width?: number | string; height?: number | string; radius?: number | string; circle?: boolean; style?: CSSProperties })` — a shimmer block `<span class="skeleton" aria-hidden>`.
  - `SkeletonScreen(props: { children: ReactNode })` — `<div role="status" aria-busy="true">` with a visually-hidden "Carregando…" label; the root every per-screen skeleton wraps its content in.
  - `SkeletonRows(props: { count: number; avatar?: boolean })` — `count` ghost `SurfaceCard` rows (optional leading circle + two text lines + a trailing pill). `avatar` defaults `true`.
  - `SkeletonField()` — a ghost form field (label block + input block).
  - `SkeletonButton()` — a ghost full-width button block.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/shared/ui/skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { Skeleton, SkeletonScreen, SkeletonRows } from './skeleton';

describe('Skeleton', () => {
  test('renders a block with the skeleton class and the given size', () => {
    render(<Skeleton width={80} height={20} />);
    const el = document.querySelector('.skeleton');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ width: '80px', height: '20px' });
  });

  test('circle uses width for both axes and a round radius', () => {
    render(<Skeleton circle width={40} />);
    const el = document.querySelector('.skeleton');
    expect(el).toHaveStyle({ width: '40px', height: '40px', borderRadius: '50%' });
  });

  test('SkeletonScreen exposes an accessible busy status with a hidden label', () => {
    render(
      <SkeletonScreen>
        <span>content</span>
      </SkeletonScreen>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Carregando…');
  });

  test('SkeletonRows renders at least one skeleton block per requested row', () => {
    render(<SkeletonRows count={3} />);
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/shared/ui/skeleton.test.tsx`
Expected: FAIL — `Cannot find module './skeleton'`.

- [ ] **Step 3: Write the primitive**

Create `apps/web/src/shared/ui/skeleton.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

import { SurfaceCard } from './primitives';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  style?: CSSProperties;
};

export function Skeleton({
  width = '100%',
  height = 14,
  radius,
  circle = false,
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className="skeleton"
      style={{
        width,
        height: circle ? width : height,
        borderRadius: circle ? '50%' : (radius ?? 'var(--r-sm)'),
        ...style,
      }}
    />
  );
}

export function SkeletonScreen({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Carregando…</span>
      {children}
    </div>
  );
}

export function SkeletonRows({ count, avatar = true }: { count: number; avatar?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, index) => (
        <SurfaceCard
          key={index}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px' }}
        >
          {avatar && <Skeleton circle width={40} style={{ flex: 'none' }} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton width="55%" height={13} style={{ display: 'block' }} />
            <Skeleton width="38%" height={11} style={{ display: 'block' }} />
          </div>
          <Skeleton width={54} height={22} radius={999} style={{ flex: 'none' }} />
        </SurfaceCard>
      ))}
    </div>
  );
}

export function SkeletonField() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Skeleton width={110} height={12} style={{ display: 'block', marginBottom: 7 }} />
      <Skeleton height={50} radius="var(--r-md)" style={{ display: 'block' }} />
    </div>
  );
}

export function SkeletonButton() {
  return <Skeleton height={52} radius="var(--r-md)" style={{ display: 'block' }} />;
}
```

- [ ] **Step 4: Append the shimmer + visually-hidden CSS**

Append to `apps/web/src/shared/ui/tokens.css` (after the existing `.spinner` block at the end):

```css
.skeleton {
  display: inline-block;
  background: var(--line-soft);
  border-radius: var(--r-sm);
  position: relative;
  overflow: hidden;
}
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none;
  }
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @morada/web test -- src/shared/ui/skeleton.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/ui/skeleton.tsx apps/web/src/shared/ui/skeleton.test.tsx apps/web/src/shared/ui/tokens.css
git commit -m "feat(ui): add shimmer skeleton primitives" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 2: Dashboard skeleton (admin)

**Files:**

- Create: `apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx`
- Modify: `apps/web/src/features/dashboard/ui/dashboard-screen.tsx:91`
- Test: `apps/web/src/features/dashboard/ui/dashboard-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonScreen`, `SkeletonRows` from `@/shared/ui/skeleton`.
- Produces: `DashboardSkeleton()` rendered when `dashboard.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/dashboard/ui/dashboard-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { DashboardSkeleton } from './dashboard-skeleton';

describe('DashboardSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<DashboardSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/dashboard/ui/dashboard-skeleton.test.tsx`
Expected: FAIL — `Cannot find module './dashboard-skeleton'`.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton height={150} radius="var(--r-lg)" style={{ display: 'block' }} />
      <Skeleton height={72} radius="var(--r-md)" style={{ display: 'block', marginTop: 12 }} />
      <Skeleton width={160} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={3} />
      <Skeleton width={160} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={2} />
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/dashboard/ui/dashboard-screen.tsx`, add the import next to the other UI imports:

```tsx
import { DashboardSkeleton } from './dashboard-skeleton';
```

Replace line 91:

```tsx
{
  dashboard.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando painel…</p>;
}
```

with:

```tsx
{
  dashboard.isLoading && <DashboardSkeleton />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/dashboard/ui/dashboard-skeleton.test.tsx src/features/dashboard/ui/dashboard-screen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx apps/web/src/features/dashboard/ui/dashboard-skeleton.test.tsx apps/web/src/features/dashboard/ui/dashboard-screen.tsx
git commit -m "feat(dashboard): show a layout skeleton while the panel loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 3: Apartamentos (residents) list skeleton (admin)

**Files:**

- Create: `apps/web/src/features/residents/ui/residents-skeleton.tsx`
- Modify: `apps/web/src/features/residents/ui/residents-screen.tsx:59`
- Test: `apps/web/src/features/residents/ui/residents-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonScreen`, `SkeletonRows`.
- Produces: `ResidentsSkeleton()` rendered when `residents.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/residents/ui/residents-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { ResidentsSkeleton } from './residents-skeleton';

describe('ResidentsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/residents/ui/residents-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/residents/ui/residents-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentsSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
        <Skeleton height={64} radius="var(--r-md)" style={{ display: 'block', flex: 1 }} />
        <Skeleton height={64} radius="var(--r-md)" style={{ display: 'block', flex: 1 }} />
        <Skeleton height={64} radius="var(--r-md)" style={{ display: 'block', flex: 1 }} />
      </div>
      <Skeleton width={180} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={5} />
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/residents/ui/residents-screen.tsx`, add:

```tsx
import { ResidentsSkeleton } from './residents-skeleton';
```

Replace line 59:

```tsx
{
  residents.isLoading && <StatusView variant="loading" message="Carregando apartamentos…" />;
}
```

with:

```tsx
{
  residents.isLoading && <ResidentsSkeleton />;
}
```

(Leave the `StatusView` import — it is still used by the error branch.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/residents/ui/residents-skeleton.test.tsx`
Expected: PASS. Then confirm the screen suite still passes: `pnpm --filter @morada/web test -- src/features/residents/ui/residents-screen`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/residents/ui/residents-skeleton.tsx apps/web/src/features/residents/ui/residents-skeleton.test.tsx apps/web/src/features/residents/ui/residents-screen.tsx
git commit -m "feat(residents): show a list skeleton while apartments load" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 4: Contas (accounts) list skeleton (admin)

**Files:**

- Create: `apps/web/src/features/accounts/ui/accounts-skeleton.tsx`
- Modify: `apps/web/src/features/accounts/ui/accounts-screen.tsx:109`
- Test: `apps/web/src/features/accounts/ui/accounts-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonScreen`, `SkeletonRows`.
- Produces: `AccountsSkeleton()` rendered when `accounts.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/accounts/ui/accounts-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { AccountsSkeleton } from './accounts-skeleton';

describe('AccountsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<AccountsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/accounts/ui/accounts-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/accounts/ui/accounts-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function AccountsSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton height={52} radius="var(--r-md)" style={{ display: 'block', marginTop: 4 }} />
      <Skeleton height={46} radius="var(--r-md)" style={{ display: 'block', marginTop: 14 }} />
      <Skeleton width={120} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={6} />
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/accounts/ui/accounts-screen.tsx`, add:

```tsx
import { AccountsSkeleton } from './accounts-skeleton';
```

Replace line 109:

```tsx
{
  accounts.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando contas…</p>;
}
```

with:

```tsx
{
  accounts.isLoading && <AccountsSkeleton />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/accounts/ui/accounts-skeleton.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/accounts/ui/accounts-skeleton.tsx apps/web/src/features/accounts/ui/accounts-skeleton.test.tsx apps/web/src/features/accounts/ui/accounts-screen.tsx
git commit -m "feat(accounts): show a list skeleton while accounts load" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 5: Outras entradas (income section) skeleton (admin)

**Files:**

- Create: `apps/web/src/features/income/ui/income-section-skeleton.tsx`
- Modify: `apps/web/src/features/income/ui/income-section.tsx:26`
- Test: `apps/web/src/features/income/ui/income-section-skeleton.test.tsx`

**Interfaces:**

- Consumes: `SkeletonScreen`, `SkeletonRows`.
- Produces: `IncomeSectionSkeleton()` rendered when `incomes.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/income/ui/income-section-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { IncomeSectionSkeleton } from './income-section-skeleton';

describe('IncomeSectionSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<IncomeSectionSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/income/ui/income-section-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/income/ui/income-section-skeleton.tsx`:

```tsx
import { SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function IncomeSectionSkeleton() {
  return (
    <SkeletonScreen>
      <SkeletonRows count={4} />
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the section**

In `apps/web/src/features/income/ui/income-section.tsx`, add:

```tsx
import { IncomeSectionSkeleton } from './income-section-skeleton';
```

Replace line 26:

```tsx
{
  incomes.isLoading && <StatusView variant="loading" message="Carregando entradas…" />;
}
```

with:

```tsx
{
  incomes.isLoading && <IncomeSectionSkeleton />;
}
```

(Leave the `StatusView` import — still used by the error branch.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/income/ui/income-section-skeleton.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/income/ui/income-section-skeleton.tsx apps/web/src/features/income/ui/income-section-skeleton.test.tsx apps/web/src/features/income/ui/income-section.tsx
git commit -m "feat(income): show a skeleton while other income loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 6: Avisos (notices) skeleton (admin + resident, shared)

**Files:**

- Create: `apps/web/src/features/notices/ui/notices-skeleton.tsx`
- Modify: `apps/web/src/features/notices/ui/notices-screen.tsx:31`
- Test: `apps/web/src/features/notices/ui/notices-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonScreen`, and `SurfaceCard` from `@/shared/ui/primitives`.
- Produces: `NoticesSkeleton()` rendered when `notices.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/notices/ui/notices-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { NoticesSkeleton } from './notices-skeleton';

describe('NoticesSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<NoticesSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/notices/ui/notices-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/notices/ui/notices-skeleton.tsx`:

```tsx
import { SurfaceCard } from '@/shared/ui/primitives';
import { Skeleton, SkeletonScreen } from '@/shared/ui/skeleton';

export function NoticesSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SurfaceCard key={index} style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <Skeleton width="50%" height={14} />
              <Skeleton width={54} height={22} radius={999} style={{ flex: 'none' }} />
            </div>
            <Skeleton width="92%" height={12} style={{ display: 'block', marginTop: 10 }} />
            <Skeleton width="70%" height={12} style={{ display: 'block', marginTop: 6 }} />
          </SurfaceCard>
        ))}
      </div>
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/notices/ui/notices-screen.tsx`, add:

```tsx
import { NoticesSkeleton } from './notices-skeleton';
```

Replace line 31:

```tsx
{
  notices.isLoading && <StatusView variant="loading" message="Carregando avisos…" />;
}
```

with:

```tsx
{
  notices.isLoading && <NoticesSkeleton />;
}
```

(Leave the `StatusView` import — still used by the error branch.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/notices/ui/notices-skeleton.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/notices/ui/notices-skeleton.tsx apps/web/src/features/notices/ui/notices-skeleton.test.tsx apps/web/src/features/notices/ui/notices-screen.tsx
git commit -m "feat(notices): show a skeleton while notices load" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 7: Ajustes (settings) skeleton (admin)

**Files:**

- Create: `apps/web/src/features/settings/ui/settings-skeleton.tsx`
- Modify: `apps/web/src/features/settings/ui/settings-screen.tsx:136`
- Test: `apps/web/src/features/settings/ui/settings-skeleton.test.tsx`

**Interfaces:**

- Consumes: `SkeletonField`, `SkeletonScreen`.
- Produces: `SettingsSkeleton()` rendered when `settings.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/settings/ui/settings-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { SettingsSkeleton } from './settings-skeleton';

describe('SettingsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<SettingsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/settings/ui/settings-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/settings/ui/settings-skeleton.tsx`:

```tsx
import { SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function SettingsSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <SkeletonField />
        <SkeletonField />
      </div>
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/settings/ui/settings-screen.tsx`, add:

```tsx
import { SettingsSkeleton } from './settings-skeleton';
```

Replace line 136:

```tsx
{
  settings.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando…</p>;
}
```

with:

```tsx
{
  settings.isLoading && <SettingsSkeleton />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/settings/ui/settings-skeleton.test.tsx src/features/settings/ui/settings-screen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/settings/ui/settings-skeleton.tsx apps/web/src/features/settings/ui/settings-skeleton.test.tsx apps/web/src/features/settings/ui/settings-screen.tsx
git commit -m "feat(settings): show a form skeleton while settings load" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 8: Editar conta (account edit) skeleton (admin)

**Files:**

- Create: `apps/web/src/features/accounts/ui/account-edit-skeleton.tsx`
- Modify: `apps/web/src/features/accounts/ui/account-edit-screen.tsx` (gate the `ScreenBody` body, ~lines 110-202)
- Test: `apps/web/src/features/accounts/ui/account-edit-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonButton`, `SkeletonField`, `SkeletonScreen`.
- Produces: `AccountEditSkeleton()` rendered when `accountId && existing.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/accounts/ui/account-edit-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { AccountEditSkeleton } from './account-edit-skeleton';

describe('AccountEditSkeleton', () => {
  test('renders an accessible busy status with field skeletons', () => {
    render(<AccountEditSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/accounts/ui/account-edit-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/accounts/ui/account-edit-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonButton, SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function AccountEditSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <Skeleton width={80} height={12} style={{ display: 'block', marginBottom: 9 }} />
        <Skeleton height={44} radius="var(--r-sm)" style={{ display: 'block', marginBottom: 20 }} />
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/accounts/ui/account-edit-screen.tsx`, add:

```tsx
import { AccountEditSkeleton } from './account-edit-skeleton';
```

Wrap the existing `ScreenBody` body. Change:

```tsx
      <ScreenBody>
        <div style={{ paddingTop: 2 }}>
          <Field
```

to:

```tsx
      <ScreenBody>
        {accountId && existing.isLoading && <AccountEditSkeleton />}
        {(!accountId || !existing.isLoading) && (
        <div style={{ paddingTop: 2 }}>
          <Field
```

and add a closing `)}` after the `</div>` that ends that block (the `</div>` immediately before `</ScreenBody>`, currently at line 201). It becomes:

```tsx
        </div>
        )}
      </ScreenBody>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/accounts/ui/account-edit-skeleton.test.tsx`
Then confirm the existing account-edit suite (if present) still passes: `pnpm --filter @morada/web test -- src/features/accounts/ui/account-edit`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/accounts/ui/account-edit-skeleton.tsx apps/web/src/features/accounts/ui/account-edit-skeleton.test.tsx apps/web/src/features/accounts/ui/account-edit-screen.tsx
git commit -m "feat(accounts): show a field skeleton while an account loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 9: Editar entrada (income edit) skeleton (admin)

**Files:**

- Create: `apps/web/src/features/income/ui/income-edit-skeleton.tsx`
- Modify: `apps/web/src/features/income/ui/income-edit-screen.tsx` (add loading gate around the form body)
- Test: `apps/web/src/features/income/ui/income-edit-skeleton.test.tsx`

**Interfaces:**

- Consumes: `SkeletonButton`, `SkeletonField`, `SkeletonScreen`.
- Produces: `IncomeEditSkeleton()` rendered when `incomeId && incomes.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/income/ui/income-edit-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { IncomeEditSkeleton } from './income-edit-skeleton';

describe('IncomeEditSkeleton', () => {
  test('renders an accessible busy status with field skeletons', () => {
    render(<IncomeEditSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/income/ui/income-edit-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/income/ui/income-edit-skeleton.tsx`:

```tsx
import { SkeletonButton, SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function IncomeEditSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/income/ui/income-edit-screen.tsx`, add the import:

```tsx
import { IncomeEditSkeleton } from './income-edit-skeleton';
```

The form body is a single `<div style={{ paddingTop: 2 }}>` opened right after `<ScreenBody>` (line 127-128) and closed by the `</div>` before `</ScreenBody>` (line 246). Change the opening (lines 127-129):

```tsx
      <ScreenBody>
        <div style={{ paddingTop: 2 }}>
          <Field
```

to:

```tsx
      <ScreenBody>
        {incomeId && incomes.isLoading && <IncomeEditSkeleton />}
        {(!incomeId || !incomes.isLoading) && (
        <div style={{ paddingTop: 2 }}>
          <Field
```

and change the closing (lines 246-247):

```tsx
        </div>
      </ScreenBody>
```

to:

```tsx
        </div>
        )}
      </ScreenBody>
```

Confirm the JSX balances: `pnpm --filter @morada/web exec tsc --noEmit`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/income/ui/income-edit-skeleton.test.tsx`
Then confirm the existing income-edit suite (if present) still passes: `pnpm --filter @morada/web test -- src/features/income/ui/income-edit`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/income/ui/income-edit-skeleton.tsx apps/web/src/features/income/ui/income-edit-skeleton.test.tsx apps/web/src/features/income/ui/income-edit-screen.tsx
git commit -m "feat(income): show a field skeleton while an income loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 10: Editar morador/apartamento (resident edit) skeleton (admin)

**Files:**

- Create: `apps/web/src/features/residents/ui/resident-edit-skeleton.tsx`
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (gate the `ScreenBody` body on `residentId && existing.isLoading`)
- Test: `apps/web/src/features/residents/ui/resident-edit-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonField`, `SkeletonRows`, `SkeletonScreen`.
- Produces: `ResidentEditSkeleton()` rendered when `residentId && existing.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/residents/ui/resident-edit-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { ResidentEditSkeleton } from './resident-edit-skeleton';

describe('ResidentEditSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentEditSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/residents/ui/resident-edit-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/residents/ui/resident-edit-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonField, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentEditSkeleton() {
  return (
    <SkeletonScreen>
      <SkeletonField />
      <SkeletonField />
      <SkeletonField />
      <SkeletonField />
      <Skeleton width={140} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={3} avatar={false} />
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/residents/ui/resident-edit-screen.tsx`, add:

```tsx
import { ResidentEditSkeleton } from './resident-edit-skeleton';
```

The body has multiple direct children of `<ScreenBody>` (from line 259 to 438), so wrap them in a fragment. Change the opening (lines 259-260):

```tsx
      <ScreenBody>
        <label style={{ display: 'block', marginBottom: 18 }}>
```

to:

```tsx
      <ScreenBody>
        {residentId && existing.isLoading && <ResidentEditSkeleton />}
        {(!residentId || !existing.isLoading) && (
          <>
        <label style={{ display: 'block', marginBottom: 18 }}>
```

and change the closing — the body's last child is the `{onCreateLogin && (...)}` block ending at line 438, before `</ScreenBody>` (line 439):

```tsx
        {onCreateLogin && (
          <button type="button" onClick={onCreateLogin} style={secondaryButtonStyle}>
            Criar acesso do morador
          </button>
        )}
      </ScreenBody>
```

to:

```tsx
        {onCreateLogin && (
          <button type="button" onClick={onCreateLogin} style={secondaryButtonStyle}>
            Criar acesso do morador
          </button>
        )}
          </>
        )}
      </ScreenBody>
```

Confirm the JSX balances: `pnpm --filter @morada/web exec tsc --noEmit`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/residents/ui/resident-edit-skeleton.test.tsx`
Then the existing resident-edit suite: `pnpm --filter @morada/web test -- src/features/residents/ui/resident-edit`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/residents/ui/resident-edit-skeleton.tsx apps/web/src/features/residents/ui/resident-edit-skeleton.test.tsx apps/web/src/features/residents/ui/resident-edit-screen.tsx
git commit -m "feat(residents): show a form skeleton while a resident loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 11: Criar acesso do morador (create login) skeleton (admin)

**Files:**

- Create: `apps/web/src/features/residents/ui/create-login-skeleton.tsx`
- Modify: `apps/web/src/features/residents/ui/create-login-screen.tsx:127-129`
- Test: `apps/web/src/features/residents/ui/create-login-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonButton`, `SkeletonField`, `SkeletonScreen`.
- Produces: `CreateLoginSkeleton()` rendered when `phase === 'loading'`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/residents/ui/create-login-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { CreateLoginSkeleton } from './create-login-skeleton';

describe('CreateLoginSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<CreateLoginSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/residents/ui/create-login-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/residents/ui/create-login-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonButton, SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function CreateLoginSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <Skeleton width="80%" height={12} style={{ display: 'block', marginBottom: 16 }} />
        <SkeletonField />
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/residents/ui/create-login-screen.tsx`, add:

```tsx
import { CreateLoginSkeleton } from './create-login-skeleton';
```

Replace lines 127-129:

```tsx
{
  phase === 'loading' && (
    <p style={{ color: 'var(--ink-500)', fontSize: '.92rem', paddingTop: 2 }}>Carregando…</p>
  );
}
```

with:

```tsx
{
  phase === 'loading' && <CreateLoginSkeleton />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/residents/ui/create-login-skeleton.test.tsx`
Then the existing create-login suite: `pnpm --filter @morada/web test -- src/features/residents/ui/create-login`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/residents/ui/create-login-skeleton.tsx apps/web/src/features/residents/ui/create-login-skeleton.test.tsx apps/web/src/features/residents/ui/create-login-screen.tsx
git commit -m "feat(residents): show a skeleton while checking resident access" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 12: Home do morador (resident home) skeleton

**Files:**

- Create: `apps/web/src/features/resident-home/ui/resident-home-skeleton.tsx`
- Modify: `apps/web/src/features/resident-home/ui/resident-home-screen.tsx:44`
- Test: `apps/web/src/features/resident-home/ui/resident-home-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonScreen`.
- Produces: `ResidentHomeSkeleton()` rendered when `home.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/resident-home/ui/resident-home-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { ResidentHomeSkeleton } from './resident-home-skeleton';

describe('ResidentHomeSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentHomeSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/resident-home/ui/resident-home-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/resident-home/ui/resident-home-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentHomeSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton width={110} height={13} style={{ display: 'block', margin: '20px 2px 11px' }} />
      <Skeleton height={190} radius="var(--r-lg)" style={{ display: 'block' }} />
      <Skeleton width={90} height={13} style={{ display: 'block', margin: '20px 2px 11px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Skeleton height={96} radius="var(--r-md)" style={{ display: 'block' }} />
        <Skeleton height={96} radius="var(--r-md)" style={{ display: 'block' }} />
      </div>
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/resident-home/ui/resident-home-screen.tsx`, add:

```tsx
import { ResidentHomeSkeleton } from './resident-home-skeleton';
```

Replace line 44:

```tsx
{
  home.isLoading && <StatusView variant="loading" message="Carregando…" />;
}
```

with:

```tsx
{
  home.isLoading && <ResidentHomeSkeleton />;
}
```

(Leave the `StatusView` import — still used by the error branch.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/resident-home/ui/resident-home-skeleton.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/resident-home/ui/resident-home-skeleton.tsx apps/web/src/features/resident-home/ui/resident-home-skeleton.test.tsx apps/web/src/features/resident-home/ui/resident-home-screen.tsx
git commit -m "feat(resident-home): show a skeleton while the home loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 13: Recibos (receipts) skeleton (resident)

**Files:**

- Create: `apps/web/src/features/receipts/ui/receipts-skeleton.tsx`
- Modify: `apps/web/src/features/receipts/ui/receipts-screen.tsx:63`
- Test: `apps/web/src/features/receipts/ui/receipts-skeleton.test.tsx`

**Interfaces:**

- Consumes: `SkeletonRows`, `SkeletonScreen`.
- Produces: `ReceiptsSkeleton()` rendered when `receipts.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/receipts/ui/receipts-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { ReceiptsSkeleton } from './receipts-skeleton';

describe('ReceiptsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ReceiptsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/receipts/ui/receipts-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/receipts/ui/receipts-skeleton.tsx`:

```tsx
import { SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ReceiptsSkeleton() {
  return (
    <SkeletonScreen>
      <SkeletonRows count={5} avatar={false} />
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/receipts/ui/receipts-screen.tsx`, add:

```tsx
import { ReceiptsSkeleton } from './receipts-skeleton';
```

Replace line 63:

```tsx
{
  receipts.isLoading && <StatusView variant="loading" message="Carregando recibos…" />;
}
```

with:

```tsx
{
  receipts.isLoading && <ReceiptsSkeleton />;
}
```

(Leave the `StatusView` import — still used by the error branch.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/receipts/ui/receipts-skeleton.test.tsx src/features/receipts/ui/receipts-screen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/receipts/ui/receipts-skeleton.tsx apps/web/src/features/receipts/ui/receipts-skeleton.test.tsx apps/web/src/features/receipts/ui/receipts-screen.tsx
git commit -m "feat(receipts): show a list skeleton while receipts load" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 14: Pagar taxa (pay) skeleton (resident)

**Files:**

- Create: `apps/web/src/features/receipts/ui/pay-skeleton.tsx`
- Modify: `apps/web/src/features/receipts/ui/pay-screen.tsx:107`
- Test: `apps/web/src/features/receipts/ui/pay-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonButton`, `SkeletonScreen`.
- Produces: `PaySkeleton()` rendered when `receipt.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/receipts/ui/pay-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { PaySkeleton } from './pay-skeleton';

describe('PaySkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<PaySkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/receipts/ui/pay-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/receipts/ui/pay-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonButton, SkeletonScreen } from '@/shared/ui/skeleton';

export function PaySkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <Skeleton
          height={110}
          radius="var(--r-md)"
          style={{ display: 'block', marginBottom: 18 }}
        />
        <Skeleton width={150} height={12} style={{ display: 'block', marginBottom: 9 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <Skeleton height={44} radius="var(--r-sm)" style={{ display: 'block', flex: 1 }} />
          <Skeleton height={44} radius="var(--r-sm)" style={{ display: 'block', flex: 1 }} />
        </div>
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/receipts/ui/pay-screen.tsx`, add:

```tsx
import { PaySkeleton } from './pay-skeleton';
```

Replace line 107:

```tsx
{
  receipt.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando recibo…</p>;
}
```

with:

```tsx
{
  receipt.isLoading && <PaySkeleton />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/receipts/ui/pay-skeleton.test.tsx src/features/receipts/ui/pay-screen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/receipts/ui/pay-skeleton.tsx apps/web/src/features/receipts/ui/pay-skeleton.test.tsx apps/web/src/features/receipts/ui/pay-screen.tsx
git commit -m "feat(receipts): show a skeleton while the payment receipt loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

### Task 15: Condomínio (resident finance) skeleton (resident)

**Files:**

- Create: `apps/web/src/features/resident-home/ui/resident-finance-skeleton.tsx`
- Modify: `apps/web/src/features/resident-home/ui/resident-finance-screen.tsx:28`
- Test: `apps/web/src/features/resident-home/ui/resident-finance-skeleton.test.tsx`

**Interfaces:**

- Consumes: `Skeleton`, `SkeletonRows`, `SkeletonScreen`.
- Produces: `ResidentFinanceSkeleton()` rendered when `finance.isLoading`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/resident-home/ui/resident-finance-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { ResidentFinanceSkeleton } from './resident-finance-skeleton';

describe('ResidentFinanceSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentFinanceSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test -- src/features/resident-home/ui/resident-finance-skeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the skeleton component**

Create `apps/web/src/features/resident-home/ui/resident-finance-skeleton.tsx`:

```tsx
import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentFinanceSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton height={170} radius="var(--r-lg)" style={{ display: 'block' }} />
      <Skeleton width={160} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={3} />
    </SkeletonScreen>
  );
}
```

- [ ] **Step 4: Wire it into the screen**

In `apps/web/src/features/resident-home/ui/resident-finance-screen.tsx`, add:

```tsx
import { ResidentFinanceSkeleton } from './resident-finance-skeleton';
```

Replace line 28:

```tsx
{
  finance.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando…</p>;
}
```

with:

```tsx
{
  finance.isLoading && <ResidentFinanceSkeleton />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @morada/web test -- src/features/resident-home/ui/resident-finance-skeleton.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full web gate**

Run: `make check`
Expected: all web gates green (typecheck, lint, prettier, Jest ≥ 80% coverage).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/resident-home/ui/resident-finance-skeleton.tsx apps/web/src/features/resident-home/ui/resident-finance-skeleton.test.tsx apps/web/src/features/resident-home/ui/resident-finance-screen.tsx
git commit -m "feat(resident-home): show a skeleton while the condo summary loads" -m "Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md"
```

---

## Final verification

- [ ] Run `make check` and confirm green.
- [ ] Manually grep for leftover plain-text loading strings that should now be skeletons:
      `grep -rn "Carregando" apps/web/src/features` — the only remaining matches should be the visually-hidden label inside `SkeletonScreen` (via the primitive) and any messages-feature screens intentionally left out of scope (`admin-messages-screen`, `thread-screen`, `support-screen`).
- [ ] Use `superpowers:finishing-a-development-branch` to decide merge/PR.
