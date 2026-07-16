# UI Polish (confirm dialog, copy password, empty/loading states) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable confirm dialog (used for archiving a resident), copy-to-clipboard on the temp password, and standardized empty/loading/error primitives applied to a fixed set of screens.

**Architecture:** Two new `shared/lib` helpers and four new `shared/ui` primitives, then wire them into existing screens. Nothing touches `domain`/`data`/API. Presentational primitives are unit-tested; screen wiring is tested through the rendered DOM with in-memory repositories.

**Tech Stack:** Vite + React 19, TypeScript strict, Jest + Testing Library + jsdom, TanStack Query (screens), Zustand (nav).

## Global Constraints

- No `any`, no non-null assertions (`!`), no `console.*` — lint errors.
- Immutability: never mutate inputs; return new objects/arrays.
- Comments only when extremely necessary.
- Design tokens only (`shared/ui/tokens.css`); no hardcoded palette values beyond what tokens expose.
- Package manager is **pnpm**. Run web scripts as `pnpm --filter @morada/web <script>`.
- Tests live beside the file as `*.test.ts(x)`. Screen tests use `renderWithClient` from `@/test/render`; factories from `@/test/factories`; in-memory repos from each feature's `data/`.
- Prefer `getByRole`/`getByLabelText`/`getByText`; `userEvent` (awaited) over `fireEvent`.
- Conventional commits, small and atomic. Never `--no-verify`. The pre-commit hook runs prettier/lint/typecheck on staged files — let it.
- Single-file test run: `pnpm --filter @morada/web test <pattern>` (passes the pattern to jest). Full gate: `make check`.

---

## File structure

**Create:**

- `apps/web/src/shared/lib/clipboard.ts` — `copyText(text)` helper.
- `apps/web/src/shared/lib/clipboard.test.ts`
- `apps/web/src/shared/ui/confirm-dialog.tsx` — reusable modal confirm.
- `apps/web/src/shared/ui/confirm-dialog.test.tsx`
- `apps/web/src/shared/ui/empty-state.tsx` — empty-state card.
- `apps/web/src/shared/ui/empty-state.test.tsx`
- `apps/web/src/shared/ui/status-view.tsx` — loading/error view.
- `apps/web/src/shared/ui/status-view.test.tsx`

**Modify:**

- `apps/web/src/shared/ui/icon.tsx` — add `x` glyph.
- `apps/web/src/shared/ui/tokens.css` — add `@keyframes spin` + `.spinner`.
- `apps/web/src/features/residents/ui/create-login-screen.tsx` — copy buttons.
- `apps/web/src/features/residents/ui/create-login-screen.test.tsx`
- `apps/web/src/features/residents/ui/resident-edit-screen.tsx` — confirm dialog on archive; EmptyState for archived list.
- `apps/web/src/features/residents/ui/resident-edit-screen.test.tsx`
- `apps/web/src/app/app.tsx` — `StatusScreen` delegates to `StatusView`.
- `apps/web/src/features/residents/ui/residents-screen.tsx` (+ test)
- `apps/web/src/features/receipts/ui/receipts-screen.tsx` (+ test)
- `apps/web/src/features/notices/ui/notices-screen.tsx` (+ test)
- `apps/web/src/features/resident-home/ui/resident-home-screen.tsx` (+ test)
- `apps/web/src/features/messages/ui/admin-messages-screen.tsx` (+ test)

---

## Task 1: `copyText` clipboard helper

**Files:**

- Create: `apps/web/src/shared/lib/clipboard.ts`
- Test: `apps/web/src/shared/lib/clipboard.test.ts`

**Interfaces:**

- Produces: `export async function copyText(text: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/shared/lib/clipboard.test.ts
import { copyText } from './clipboard';

describe('copyText', () => {
  test('writes the given text to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await copyText('7Kq2Ab9m');

    expect(writeText).toHaveBeenCalledWith('7Kq2Ab9m');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test clipboard`
Expected: FAIL — cannot find module `./clipboard`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/shared/lib/clipboard.ts
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test clipboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/lib/clipboard.ts apps/web/src/shared/lib/clipboard.test.ts
git commit -m "feat(web): add copyText clipboard helper"
```

---

## Task 2: Copy buttons on the temp password (C)

**Files:**

- Modify: `apps/web/src/features/residents/ui/create-login-screen.tsx`
- Test: `apps/web/src/features/residents/ui/create-login-screen.test.tsx`

**Interfaces:**

- Consumes: `copyText` from `@/shared/lib/clipboard` (Task 1).

- [ ] **Step 1: Write the failing test** (append to the existing describe block)

```tsx
// add these imports at the top of create-login-screen.test.tsx
// (userEvent + render/screen already imported)

test('copies the generated temp password to the clipboard', async () => {
  const user = userEvent.setup();
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  const provision = jest.fn().mockResolvedValue({ username: 'maria302', tempPassword: '7Kq2Ab9m' });

  render(
    <CreateLoginScreen
      residentId="r-1"
      residentName="Maria Ribeiro"
      provision={provision}
      onBack={jest.fn()}
    />,
  );

  await user.type(screen.getByLabelText('Usuário'), 'maria302');
  await user.click(screen.getByRole('button', { name: 'Criar acesso' }));
  await screen.findByText('7Kq2Ab9m');

  await user.click(screen.getByRole('button', { name: 'Copiar Senha temporária' }));

  expect(writeText).toHaveBeenCalledWith('7Kq2Ab9m');
  expect(await screen.findByText('Copiado!')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test create-login-screen`
Expected: FAIL — no button named "Copiar Senha temporária".

- [ ] **Step 3: Implement copy buttons**

In `create-login-screen.tsx`:

Add import: `import { copyText } from '@/shared/lib/clipboard';`

Replace the `CredentialRow` component with a copy-capable version:

```tsx
function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderTop: '1px solid var(--line)',
      }}
    >
      <span style={{ color: 'var(--ink-500)', fontSize: '.86rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 600,
            color: 'var(--ink-900)',
            fontVariantLigatures: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`Copiar ${label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            flex: 'none',
            minHeight: 32,
            padding: '0 10px',
            border: '1.5px solid var(--petrol-100)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--petrol-50)',
            color: 'var(--petrol-800)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.78rem',
            cursor: 'pointer',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
```

Ensure `useState` is imported (the file already imports `useState`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test create-login-screen`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/residents/ui/create-login-screen.tsx apps/web/src/features/residents/ui/create-login-screen.test.tsx
git commit -m "feat(web): copy buttons for provisioned login credentials"
```

---

## Task 3: `x` icon + `ConfirmDialog` primitive (B, part 1)

**Files:**

- Modify: `apps/web/src/shared/ui/icon.tsx`
- Create: `apps/web/src/shared/ui/confirm-dialog.tsx`
- Test: `apps/web/src/shared/ui/confirm-dialog.test.tsx`

**Interfaces:**

- Produces:

```ts
type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string; // default 'Cancelar'
  tone?: 'default' | 'danger'; // default 'default'
  isPending?: boolean; // default false
  onConfirm: () => void;
  onCancel: () => void;
};
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null;
```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/shared/ui/confirm-dialog.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmDialog } from './confirm-dialog';

function props(overrides = {}) {
  return {
    open: true,
    title: 'Registrar saída de Maria?',
    confirmLabel: 'Confirmar saída',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  test('renders nothing when closed', () => {
    render(<ConfirmDialog {...props({ open: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('shows the title and confirm/cancel actions when open', () => {
    render(<ConfirmDialog {...props()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Registrar saída de Maria?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar saída' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  test('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    await user.click(screen.getByRole('button', { name: 'Confirmar saída' }));
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel on cancel button and on Escape', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.keyboard('{Escape}');
    expect(p.onCancel).toHaveBeenCalledTimes(2);
  });

  test('calls onCancel when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    expect(p.onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test confirm-dialog`
Expected: FAIL — cannot find module `./confirm-dialog`.

- [ ] **Step 3a: Add the `x` glyph to `icon.tsx`**

In the `PATHS` object add:

```ts
  x: 'M18 6L6 18M6 6l12 12',
```

- [ ] **Step 3b: Implement `ConfirmDialog`**

```tsx
// apps/web/src/shared/ui/confirm-dialog.tsx
import { useEffect, useRef } from 'react';

import { Icon } from './icon';

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'default',
  isPending = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const danger = tone === 'danger';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(15,46,52,.45)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-3)',
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: message ? 8 : 16,
          }}
        >
          <h2
            id="confirm-dialog-title"
            className="fraunces"
            style={{
              flex: 1,
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: 600,
              color: 'var(--ink-900)',
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            style={{
              width: 30,
              height: 30,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              background: 'transparent',
              color: 'var(--ink-500)',
              cursor: 'pointer',
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {message && (
          <p
            style={{
              margin: '0 0 18px',
              color: 'var(--ink-500)',
              fontSize: '.92rem',
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: 'var(--r-md)',
              border: '1.5px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink-700)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '.95rem',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            style={{
              flex: 1,
              minHeight: 46,
              border: 'none',
              borderRadius: 'var(--r-md)',
              background: danger ? 'var(--atraso-700)' : 'var(--brass-500)',
              color: danger ? '#fff' : 'var(--petrol-900)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '.95rem',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test confirm-dialog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/ui/icon.tsx apps/web/src/shared/ui/confirm-dialog.tsx apps/web/src/shared/ui/confirm-dialog.test.tsx
git commit -m "feat(web): add ConfirmDialog primitive and x icon"
```

---

## Task 4: Confirm before archiving a resident (B, part 2)

**Files:**

- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx`
- Test: `apps/web/src/features/residents/ui/resident-edit-screen.test.tsx`

**Interfaces:**

- Consumes: `ConfirmDialog` from `@/shared/ui/confirm-dialog` (Task 3).

- [ ] **Step 1: Write the failing test** (append a new test; reuse the file's existing `setup`/render pattern — read the top of `resident-edit-screen.test.tsx` for the exact helper and imports before writing)

```tsx
test('archiving a resident asks for confirmation before deactivating', async () => {
  const user = userEvent.setup();
  const repository = new InMemoryResidentRepository([
    buildResident({ id: 'r-1', name: 'Maria Ribeiro', apt: 'Apto 302', active: true }),
  ]);
  const deactivateSpy = jest.spyOn(repository, 'deactivate');
  renderWithClient(
    <ResidentEditScreen
      repository={repository}
      receiptRepository={new InMemoryReceiptRepository([])}
      residentId="r-1"
      onBack={jest.fn()}
    />,
  );

  await user.click(await screen.findByRole('button', { name: /arquivar morador/i }));

  // Dialog is shown, nothing deactivated yet.
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(deactivateSpy).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: /confirmar saída/i }));

  await waitFor(() => expect(deactivateSpy).toHaveBeenCalledWith('r-1'));
});

test('cancelling the archive confirmation does not deactivate', async () => {
  const user = userEvent.setup();
  const repository = new InMemoryResidentRepository([
    buildResident({ id: 'r-1', name: 'Maria Ribeiro', apt: 'Apto 302', active: true }),
  ]);
  const deactivateSpy = jest.spyOn(repository, 'deactivate');
  renderWithClient(
    <ResidentEditScreen
      repository={repository}
      receiptRepository={new InMemoryReceiptRepository([])}
      residentId="r-1"
      onBack={jest.fn()}
    />,
  );

  await user.click(await screen.findByRole('button', { name: /arquivar morador/i }));
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(deactivateSpy).not.toHaveBeenCalled();
});
```

> If `InMemoryReceiptRepository` / `InMemoryResidentRepository` import paths differ, copy them from the existing tests already in `resident-edit-screen.test.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test resident-edit-screen`
Expected: FAIL — clicking archive deactivates immediately (no dialog role found / `deactivate` called without confirm).

- [ ] **Step 3: Wire the ConfirmDialog**

In `resident-edit-screen.tsx`:

Add import: `import { ConfirmDialog } from '@/shared/ui/confirm-dialog';`

Add state near the other `useState` calls:

```tsx
const [confirmingMoveOut, setConfirmingMoveOut] = useState(false);
```

Change the archive button's handler (the `moveOut` button in the `SectionLabel` `right`) from `onClick={moveOut}` to:

```tsx
onClick={() => setConfirmingMoveOut(true)}
```

Keep the existing `moveOut` function. Just before the closing `</ScreenBody>` (or `</Screen>`), render the dialog:

```tsx
<ConfirmDialog
  open={confirmingMoveOut}
  title={`Registrar saída de ${existing.data?.name || 'deste morador'}?`}
  message={`${existing.data?.name || 'O morador'} deixa de ser o morador ativo do ${existing.data?.apt ?? 'apartamento'}. O histórico do apartamento é preservado.`}
  confirmLabel="Confirmar saída"
  tone="danger"
  isPending={deactivate.isPending}
  onConfirm={() => {
    setConfirmingMoveOut(false);
    moveOut();
  }}
  onCancel={() => setConfirmingMoveOut(false)}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test resident-edit-screen`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/residents/ui/resident-edit-screen.tsx apps/web/src/features/residents/ui/resident-edit-screen.test.tsx
git commit -m "feat(web): confirm before archiving a resident"
```

---

## Task 5: `EmptyState` primitive (D, part 1)

**Files:**

- Create: `apps/web/src/shared/ui/empty-state.tsx`
- Test: `apps/web/src/shared/ui/empty-state.test.tsx`

**Interfaces:**

- Produces:

```ts
type EmptyStateProps = {
  icon?: IconName; // from '@/shared/ui/icon'
  title: string;
  description?: string;
  action?: ReactNode;
};
export function EmptyState(props: EmptyStateProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/shared/ui/empty-state.test.tsx
import { render, screen } from '@testing-library/react';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  test('renders the title', () => {
    render(<EmptyState title="Nenhum recibo ainda" />);
    expect(screen.getByText('Nenhum recibo ainda')).toBeInTheDocument();
  });

  test('renders an optional description and action', () => {
    render(
      <EmptyState
        icon="receipt"
        title="Nenhum recibo ainda"
        description="Os recibos aparecem aqui."
        action={<button type="button">Adicionar</button>}
      />,
    );
    expect(screen.getByText('Os recibos aparecem aqui.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test empty-state`
Expected: FAIL — cannot find module `./empty-state`.

- [ ] **Step 3: Implement `EmptyState`**

```tsx
// apps/web/src/shared/ui/empty-state.tsx
import type { ReactNode } from 'react';

import { Icon, type IconName } from './icon';

type Props = {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
        padding: '22px 18px',
        background: 'var(--surface-2)',
        border: '1px dashed var(--line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      {icon && (
        <div
          style={{
            width: 44,
            height: 44,
            marginBottom: 4,
            borderRadius: 999,
            background: 'var(--petrol-50)',
            color: 'var(--petrol-600)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name={icon} size={20} />
        </div>
      )}
      <div style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--ink-900)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: '.86rem', color: 'var(--ink-500)', maxWidth: 260 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test empty-state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/ui/empty-state.tsx apps/web/src/shared/ui/empty-state.test.tsx
git commit -m "feat(web): add EmptyState primitive"
```

---

## Task 6: `StatusView` primitive + `app.tsx` refactor (D, part 2)

**Files:**

- Modify: `apps/web/src/shared/ui/tokens.css` (add spinner keyframe)
- Create: `apps/web/src/shared/ui/status-view.tsx`
- Test: `apps/web/src/shared/ui/status-view.test.tsx`
- Modify: `apps/web/src/app/app.tsx` (delegate `StatusScreen` to `StatusView`)

**Interfaces:**

- Produces:

```ts
type StatusViewProps = {
  variant: 'loading' | 'error';
  message: string;
  onRetry?: () => void;
};
export function StatusView(props: StatusViewProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/shared/ui/status-view.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StatusView } from './status-view';

describe('StatusView', () => {
  test('renders a loading message with status role', () => {
    render(<StatusView variant="loading" message="Carregando…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
  });

  test('renders an error message with alert role', () => {
    render(<StatusView variant="error" message="Falhou." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou.');
  });

  test('calls onRetry from the retry button in the error variant', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<StatusView variant="error" message="Falhou." onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test status-view`
Expected: FAIL — cannot find module `./status-view`.

- [ ] **Step 3a: Add the spinner keyframe to `tokens.css`**

Append to `apps/web/src/shared/ui/tokens.css`:

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid var(--petrol-100);
  border-top-color: var(--petrol-600);
  animation: spin 0.8s linear infinite;
}
```

- [ ] **Step 3b: Implement `StatusView`**

```tsx
// apps/web/src/shared/ui/status-view.tsx
type Props = {
  variant: 'loading' | 'error';
  message: string;
  onRetry?: () => void;
};

export function StatusView({ variant, message, onRetry }: Props) {
  const isError = variant === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 14,
        minHeight: '55%',
        textAlign: 'center',
        padding: 24,
      }}
    >
      {!isError && <div className="spinner" aria-hidden="true" />}
      <p style={{ margin: 0, color: isError ? 'var(--atraso-700)' : 'var(--ink-500)' }}>
        {message}
      </p>
      {isError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            minHeight: 42,
            padding: '0 18px',
            borderRadius: 'var(--r-md)',
            border: '1.5px solid var(--petrol-600)',
            background: 'var(--surface)',
            color: 'var(--petrol-800)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.92rem',
            cursor: 'pointer',
          }}
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test status-view`
Expected: PASS.

- [ ] **Step 5: Delegate `StatusScreen` in `app.tsx` to `StatusView`**

Read `apps/web/src/app/app.tsx` around the `StatusScreen` definition (function near line 307) and its two call sites (loading near line 250, error near line 253).

Add import: `import { StatusView } from '@/shared/ui/status-view';`

Replace the `StatusScreen` function body with a delegating version and add an optional `variant`:

```tsx
function StatusScreen({
  message,
  bottomNav,
  variant = 'loading',
}: {
  message: string;
  bottomNav: ReactNode;
  variant?: 'loading' | 'error';
}) {
  return (
    <Screen>
      <ScreenBody>
        <StatusView variant={variant} message={message} />
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}
```

At the error call site, pass `variant="error"`:

```tsx
return (
  <StatusScreen variant="error" message="Não foi possível carregar seus dados." bottomNav={nav} />
);
```

Leave the loading call site as-is (defaults to `'loading'`).

- [ ] **Step 6: Run the full web suite to verify no regression**

Run: `pnpm --filter @morada/web test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/ui/tokens.css apps/web/src/shared/ui/status-view.tsx apps/web/src/shared/ui/status-view.test.tsx apps/web/src/app/app.tsx
git commit -m "feat(web): add StatusView primitive and route StatusScreen through it"
```

---

## Task 7: Apply empty/loading/error to `residents-screen` (D)

**Files:**

- Modify: `apps/web/src/features/residents/ui/residents-screen.tsx`
- Test: `apps/web/src/features/residents/ui/residents-screen.test.tsx`

**Interfaces:**

- Consumes: `StatusView` (Task 6), `EmptyState` (Task 5).

- [ ] **Step 1: Write the failing tests** (append to the existing describe; the file already imports `screen`, `userEvent`, `renderWithClient`, `buildResident`, `InMemoryResidentRepository`)

```tsx
test('shows an empty state with a CTA when there are no apartments', async () => {
  const repository = new InMemoryResidentRepository([]);
  const onOpenResident = jest.fn();
  renderWithClient(
    <ResidentsScreen repository={repository} onOpenResident={onOpenResident} bottomNav={null} />,
  );

  expect(await screen.findByText('Nenhum apartamento cadastrado')).toBeInTheDocument();
  // the empty state's CTA opens the new-apartment form
  await userEvent.click(screen.getByRole('button', { name: /cadastrar o primeiro apartamento/i }));
  expect(onOpenResident).toHaveBeenCalledWith();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test residents-screen`
Expected: FAIL — "Nenhum apartamento cadastrado" not found.

- [ ] **Step 3: Wire the primitives**

In `residents-screen.tsx`:

Add imports:

```tsx
import { EmptyState } from '@/shared/ui/empty-state';
import { StatusView } from '@/shared/ui/status-view';
```

Replace the loading/error `<p>` lines inside `ScreenBody` with:

```tsx
{
  residents.isLoading && <StatusView variant="loading" message="Carregando apartamentos…" />;
}
{
  residents.isError && (
    <StatusView
      variant="error"
      message="Não foi possível carregar os apartamentos."
      onRetry={() => void residents.refetch()}
    />
  );
}
```

In `ResidentsContent`, replace the filtered-empty `<p>` block. Distinguish "no apartments at all" (CTA) from "filter matched nothing":

```tsx
{
  filtered.length === 0 ? (
    residents.length === 0 ? (
      <EmptyState
        icon="building"
        title="Nenhum apartamento cadastrado"
        description="Cadastre o primeiro apartamento e seu morador."
        action={
          <PrimaryButton icon="userPlus" onClick={() => onOpenResident()}>
            Cadastrar o primeiro apartamento
          </PrimaryButton>
        }
      />
    ) : (
      <EmptyState title="Nenhum apartamento encontrado" />
    )
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {filtered.map((resident) => (
        <ResidentRow
          key={resident.id}
          resident={resident}
          onClick={() => onOpenResident(resident.id)}
        />
      ))}
    </div>
  );
}
```

(`residents` is already available in `ResidentsContent` via its props.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test residents-screen`
Expected: PASS (all tests in the file, including the existing filter test which still finds `Bruno Lima`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/residents/ui/residents-screen.tsx apps/web/src/features/residents/ui/residents-screen.test.tsx
git commit -m "feat(web): empty and status states for the apartments list"
```

---

## Task 8: Apply to `receipts-screen` and `notices-screen` (D)

**Files:**

- Modify: `apps/web/src/features/receipts/ui/receipts-screen.tsx` (+ `.test.tsx`)
- Modify: `apps/web/src/features/notices/ui/notices-screen.tsx` (+ `.test.tsx`)

**Interfaces:**

- Consumes: `StatusView`, `EmptyState`.

- [ ] **Step 1: Write the failing test for receipts** (append to `receipts-screen.test.tsx`; read its top for the existing setup: it uses `renderWithClient`, an in-memory receipt repo, and passes `resident={{ name, apt }}`)

```tsx
test('shows an empty state when the resident has no receipts', async () => {
  const repository = new InMemoryReceiptRepository([]);
  renderWithClient(
    <ReceiptsScreen
      repository={repository}
      resident={{ name: 'Maria', apt: 'Apto 302' }}
      onPay={jest.fn()}
      bottomNav={null}
    />,
  );
  expect(await screen.findByText('Nenhum recibo ainda')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test receipts-screen`
Expected: FAIL — "Nenhum recibo ainda" not found.

- [ ] **Step 3: Wire receipts-screen**

Add imports for `StatusView` and `EmptyState`. Replace the loading/error `<p>` lines with `StatusView` (loading message "Carregando recibos…"; error message "Não foi possível carregar os recibos." with `onRetry={() => void receipts.refetch()}`). In the `isSuccess` branch, when the receipts list is empty, render:

```tsx
<EmptyState
  icon="receipt"
  title="Nenhum recibo ainda"
  description="Seus recibos de pagamento aparecem aqui."
/>
```

Read the current `isSuccess` block to place the empty check correctly (render the list when non-empty, the `EmptyState` when empty).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test receipts-screen`
Expected: PASS.

- [ ] **Step 5: Write the failing test for notices** (append to `notices-screen.test.tsx`; it uses `renderWithClient` + an in-memory notice repo)

```tsx
test('shows an empty state when there are no notices', async () => {
  const repository = new InMemoryNoticeRepository([]);
  renderWithClient(<NoticesScreen repository={repository} bottomNav={null} />);
  expect(await screen.findByText('Nenhum aviso no momento')).toBeInTheDocument();
});
```

> Use the same `InMemoryNoticeRepository` import the existing tests in the file use.

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @morada/web test notices-screen`
Expected: FAIL — the empty text is currently a plain `<p>`; assert it now renders through `EmptyState`. If the plain text already reads "Nenhum aviso no momento." (with a period), change the assertion target to the new `EmptyState` copy "Nenhum aviso no momento" (no trailing period) so the test meaningfully drives the swap.

- [ ] **Step 7: Wire notices-screen**

Add imports. Replace the loading/error `<p>` lines with `StatusView` (loading "Carregando avisos…"; error "Não foi possível carregar os avisos." + `onRetry={() => void notices.refetch()}`). Replace the `active.length === 0` plain-text block with:

```tsx
<EmptyState
  icon="bell"
  title="Nenhum aviso no momento"
  description="Os comunicados do síndico aparecem aqui."
/>
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @morada/web test notices-screen`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/receipts/ui/receipts-screen.tsx apps/web/src/features/receipts/ui/receipts-screen.test.tsx apps/web/src/features/notices/ui/notices-screen.tsx apps/web/src/features/notices/ui/notices-screen.test.tsx
git commit -m "feat(web): empty and status states for receipts and notices"
```

---

## Task 9: Apply to `resident-home-screen`, `admin-messages-screen`, and the archived-residents empty (D)

**Files:**

- Modify: `apps/web/src/features/resident-home/ui/resident-home-screen.tsx` (+ `.test.tsx`)
- Modify: `apps/web/src/features/messages/ui/admin-messages-screen.tsx` (+ `.test.tsx`)
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (archived empty only) (+ `.test.tsx`)

**Interfaces:**

- Consumes: `StatusView`, `EmptyState`.

- [ ] **Step 1: Write the failing test for the admin inbox empty** (append to `admin-messages-screen.test.tsx`; it uses `renderWithClient` + an in-memory thread repo + `onOpenThread`)

```tsx
test('shows an empty state when there are no conversations', async () => {
  const repository = new InMemoryThreadRepository([]);
  renderWithClient(
    <AdminMessagesScreen repository={repository} onOpenThread={jest.fn()} bottomNav={null} />,
  );
  expect(await screen.findByText('Nenhuma conversa ainda')).toBeInTheDocument();
});
```

> Use the same `InMemoryThreadRepository` import the existing tests in the file use.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test admin-messages-screen`
Expected: FAIL — current copy is "Nenhuma conversa por aqui ainda." (plain `<p>`); the new `EmptyState` copy is "Nenhuma conversa ainda".

- [ ] **Step 3: Wire admin-messages-screen**

Add imports. Replace the loading/error `<p>` lines with `StatusView` (loading "Carregando conversas…"; error "Não foi possível carregar as conversas." + `onRetry={() => void threads.refetch()}`). Replace the `threads.data.length === 0` plain-text block with:

```tsx
<EmptyState
  icon="message"
  title="Nenhuma conversa ainda"
  description="As mensagens dos moradores aparecem aqui."
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test admin-messages-screen`
Expected: PASS.

- [ ] **Step 5: Wire resident-home-screen loading/error**

Read `resident-home-screen.tsx`. Add the `StatusView` import. Replace the loading `<p>` ("Carregando…") with `<StatusView variant="loading" message="Carregando…" />` and the error `<p>` with `<StatusView variant="error" message="Não foi possível carregar sua taxa." onRetry={() => void home.refetch()} />`. Do NOT change the "Nenhuma taxa pendente no momento." inline content (that is domain copy inside the success layout, not an empty-state swap for this task).

- [ ] **Step 6: Run the resident-home tests**

Run: `pnpm --filter @morada/web test resident-home-screen`
Expected: PASS (existing tests still pass; loading/error now render through `StatusView`).

- [ ] **Step 7: Swap the archived-residents empty in `resident-edit-screen`**

Read the archived-residents empty block in `resident-edit-screen.tsx` (the `archived.length === 0` branch rendering "Nenhum morador antigo registrado." inside a dashed div). Add the `EmptyState` import and replace that inline dashed `<div>` with:

```tsx
<EmptyState title="Nenhum morador antigo registrado" />
```

Do NOT touch the receipts-section empty (owned by sub-project 2).

- [ ] **Step 8: Add/adjust the archived-empty test** (append to `resident-edit-screen.test.tsx`)

```tsx
test('shows an empty state under moradores antigos when there is no history', async () => {
  const user = userEvent.setup();
  const repository = new InMemoryResidentRepository([
    buildResident({ id: 'r-1', name: 'Maria Ribeiro', apt: 'Apto 302', active: true }),
  ]);
  renderWithClient(
    <ResidentEditScreen
      repository={repository}
      receiptRepository={new InMemoryReceiptRepository([])}
      residentId="r-1"
      onBack={jest.fn()}
    />,
  );

  await user.click(await screen.findByRole('button', { name: /ver moradores antigos/i }));
  expect(await screen.findByText('Nenhum morador antigo registrado')).toBeInTheDocument();
});
```

- [ ] **Step 9: Run the resident-edit tests**

Run: `pnpm --filter @morada/web test resident-edit-screen`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/resident-home/ui/resident-home-screen.tsx apps/web/src/features/messages/ui/admin-messages-screen.tsx apps/web/src/features/messages/ui/admin-messages-screen.test.tsx apps/web/src/features/residents/ui/resident-edit-screen.tsx apps/web/src/features/residents/ui/resident-edit-screen.test.tsx
git commit -m "feat(web): empty and status states for resident home, admin inbox, and archived residents"
```

---

## Task 10: Final gate

- [ ] **Step 1: Run the full web gate**

Run: `make check`
Expected: PASS — typecheck, lint, prettier, and the full Jest suite green with coverage ≥ 80%.

- [ ] **Step 2: If coverage dips below 80%**, add focused tests for any uncovered new branch (most likely a `StatusView` error `onRetry` path or an `EmptyState` variant) — do not lower the threshold.

- [ ] **Step 3: No commit needed** unless Step 2 added tests; then commit them:

```bash
git add -A && git commit -m "test(web): cover remaining empty/status branches"
```

---

## Self-review notes

- **Spec coverage:** C → Tasks 1–2. B → Tasks 3–4. D primitives → Tasks 5–6; D application (6 sites) → Tasks 7–9. Icons (`x`) → Task 3. Clipboard helper → Task 1. All spec sections map to a task.
- **Out of scope respected:** the receipts-section empty in `resident-edit-screen` is explicitly left for sub-project 2 (Task 9, Step 7 note); contas/settings/thread untouched.
- **Type consistency:** `ConfirmDialog` prop names, `StatusView` `variant`/`onRetry`, and `EmptyState` `icon`/`title`/`description`/`action` are used identically in the wiring tasks.
- **Copy drift note:** admin inbox empty copy changes "Nenhuma conversa por aqui ainda." → "Nenhuma conversa ainda"; notices empty may drop a trailing period — tests assert the new copy so the swap is real.
