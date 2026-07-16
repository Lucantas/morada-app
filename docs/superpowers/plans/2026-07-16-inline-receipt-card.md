# Inline Receipt Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate add-charge screen with an inline "Novo recibo" card in the apartment view that lets the admin add several receipts in a row, with the due date derived from the competência month + the condo due-day and an optional payment proof.

**Architecture:** One small API change (createReceipt accepts an optional proofDataUrl) plus web work: a pure due-date helper, a self-contained `NewReceiptCard` component, wiring it into the receipts section, and deleting the old screen/route. Domain stays pure; boundaries `ui → domain ← data` preserved.

**Tech Stack:** Hono + Postgres API (hexagonal), Vite + React 19 web (TS strict), Jest + Testing Library + jsdom, TanStack Query, Zustand nav.

## Global Constraints

- No `any`, no non-null assertions (`!`), no `console.*`. Immutability. Comments only when extremely necessary. Design tokens only.
- pnpm only. Web tests: `pnpm --filter @morada/web test <pattern>`; API tests: `pnpm --filter @morada/api test <pattern>` (or `make api-test`). Full gates: `make check` (web), `make api-check` (api).
- Conventional commits; never `--no-verify`; let the pre-commit hook run.
- Receipt method enum is `'dinheiro' | 'pix'`. Receipt title for the monthly fee is the fixed string `'Taxa condominial'`. Competência format is `MM/AAAA` (e.g. `04/2026`).
- The web always talks to the real API; in-memory repos are for tests only.

---

## File structure

**Create:**

- `apps/web/src/features/receipts/domain/due-date.ts` + `.test.ts` — `dueDateFromRef`.
- `apps/web/src/features/residents/ui/new-receipt-card.tsx` + `.test.tsx` — inline card.

**Modify:**

- `apps/api/src/receipts/app/create-receipt.ts` (+ `create-receipt.test.ts`) — accept `proofDataUrl`.
- `apps/web/src/app/container.ts` — `issueCharge` input gains `proofDataUrl?`.
- `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (+ test) — render the card; drop `onIssueCharge`; accept `dueDay`.
- `apps/web/src/app/app.tsx` — compute `dueDay` from settings, pass to `ResidentEditScreen`; remove the `a-resident-charge` case + `IssueChargeScreen` import.
- `apps/web/src/app/nav-store.ts` — remove the `a-resident-charge` view.

**Delete:**

- `apps/web/src/features/residents/ui/issue-charge-screen.tsx` + `issue-charge-screen.test.tsx`.

---

## Task 1: API — `createReceipt` accepts an optional `proofDataUrl`

**Files:**

- Modify: `apps/api/src/receipts/app/create-receipt.ts`
- Test: `apps/api/src/receipts/app/create-receipt.test.ts`

**Interfaces:**

- Produces: `createReceipt(repo, residentApartment, input)` now accepts `input.proofDataUrl?: string`; persisted only when the receipt is created paid (`paidAt` + `method` present).

- [ ] **Step 1: Write the failing tests** (append to the existing describe block)

```ts
test('persists the proof when creating an already-paid receipt with a proofDataUrl', async () => {
  const repo = fakeRepo();
  const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), {
    residentId: 'r-1',
    ref: '06/2026',
    title: 'Taxa condominial',
    valueCents: 15000,
    dueDate: '2026-06-15',
    paidAt: '2026-06-14',
    method: 'dinheiro',
    proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  });
  expect(receipt).toMatchObject({
    status: 'pago',
    method: 'dinheiro',
    proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  });
});

test('ignores proofDataUrl when the receipt is created pending', async () => {
  const repo = fakeRepo();
  const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), {
    ...validInput,
    proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  });
  expect(receipt.status).toBe('pendente');
  expect(receipt.proofDataUrl).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/api test create-receipt`
Expected: FAIL — proof not persisted (undefined) / present when pending.

- [ ] **Step 3: Implement**

In `create-receipt.ts`, add to `inputSchema`:

```ts
  proofDataUrl: z.string().optional(),
```

Then include it in the paid branch. Replace the destructure + build with:

```ts
const paid = parsed.data.paidAt !== undefined && parsed.data.method !== undefined;
const { paidAt, method, proofDataUrl, ...base } = parsed.data;
const receipt = receiptSchema.parse({
  ...base,
  id: randomUUID(),
  apartmentId: apartment.apartmentId,
  status: paid ? 'pago' : 'pendente',
  ...(paid ? { paidAt, method, ...(proofDataUrl ? { proofDataUrl } : {}) } : {}),
});
```

(`base` no longer carries `proofDataUrl`, so a pending receipt never gets it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/api test create-receipt`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts/app/create-receipt.ts apps/api/src/receipts/app/create-receipt.test.ts
git commit -m "feat(api): accept optional payment proof when creating a paid receipt"
```

---

## Task 2: Web — `dueDateFromRef` helper

**Files:**

- Create: `apps/web/src/features/receipts/domain/due-date.ts`
- Test: `apps/web/src/features/receipts/domain/due-date.test.ts`

**Interfaces:**

- Produces: `export function dueDateFromRef(ref: string, dueDay: number): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/receipts/domain/due-date.test.ts
import { dueDateFromRef } from './due-date';

describe('dueDateFromRef', () => {
  test('derives an ISO due date from MM/AAAA and the due day', () => {
    expect(dueDateFromRef('04/2026', 15)).toBe('2026-04-15');
    expect(dueDateFromRef('12/2026', 5)).toBe('2026-12-05');
  });

  test('zero-pads month and day', () => {
    expect(dueDateFromRef('4/2026', 9)).toBe('2026-04-09');
  });

  test('returns null for non MM/AAAA input', () => {
    expect(dueDateFromRef('Água 04/2026', 15)).toBeNull();
    expect(dueDateFromRef('2026-04', 15)).toBeNull();
    expect(dueDateFromRef('', 15)).toBeNull();
  });

  test('returns null for an out-of-range month', () => {
    expect(dueDateFromRef('13/2026', 15)).toBeNull();
    expect(dueDateFromRef('00/2026', 15)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test due-date`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/features/receipts/domain/due-date.ts
export function dueDateFromRef(ref: string, dueDay: number): string | null {
  const match = /^\s*(\d{1,2})\/(\d{4})\s*$/.exec(ref);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(dueDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test due-date`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/receipts/domain/due-date.ts apps/web/src/features/receipts/domain/due-date.test.ts
git commit -m "feat(web): derive receipt due date from competência and due day"
```

---

## Task 3: Web — `NewReceiptCard` component

**Files:**

- Create: `apps/web/src/features/residents/ui/new-receipt-card.tsx`
- Test: `apps/web/src/features/residents/ui/new-receipt-card.test.tsx`

**Interfaces:**

- Consumes: `dueDateFromRef` (Task 2); `fileToDataUrl`/`isAllowedProof` from `@/features/receipts/domain/proof`; `ReceiptMethod` from `@/features/receipts/domain/receipt`; `MoneyInput`.
- Produces:

```ts
type NewReceiptCardProps = {
  dueDay: number;
  issue: (input: {
    ref: string;
    valueCents: number;
    dueDate: string;
    paidAt?: string;
    method?: 'dinheiro' | 'pix';
    proofDataUrl?: string;
  }) => Promise<void>;
  onClose: () => void;
};
export function NewReceiptCard(props: NewReceiptCardProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/residents/ui/new-receipt-card.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NewReceiptCard } from './new-receipt-card';

describe('NewReceiptCard', () => {
  test('adds a pending receipt with the derived due date and keeps the card open', async () => {
    const user = userEvent.setup();
    const issue = jest.fn().mockResolvedValue(undefined);
    render(<NewReceiptCard dueDay={15} issue={issue} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Competência'), '04/2026');
    await user.type(screen.getByLabelText('Valor'), '15000');
    await user.click(screen.getByRole('button', { name: /adicionar e continuar/i }));

    await waitFor(() =>
      expect(issue).toHaveBeenCalledWith({
        ref: '04/2026',
        valueCents: 15000,
        dueDate: '2026-04-15',
      }),
    );
    // card stays open with cleared competência
    expect(screen.getByLabelText('Competência')).toHaveValue('');
  });

  test('blocks saving when the competência is not MM/AAAA', async () => {
    const user = userEvent.setup();
    const issue = jest.fn();
    render(<NewReceiptCard dueDay={15} issue={issue} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Competência'), 'abril');
    await user.type(screen.getByLabelText('Valor'), '15000');
    await user.click(screen.getByRole('button', { name: /adicionar e continuar/i }));

    expect(issue).not.toHaveBeenCalled();
    expect(screen.getByText(/use mm\/aaaa/i)).toBeInTheDocument();
  });

  test('sends paidAt and method when marked paid', async () => {
    const user = userEvent.setup();
    const issue = jest.fn().mockResolvedValue(undefined);
    render(<NewReceiptCard dueDay={10} issue={issue} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Competência'), '05/2026');
    await user.type(screen.getByLabelText('Valor'), '20000');
    await user.click(screen.getByRole('button', { name: 'Pago' }));
    await user.click(screen.getByRole('button', { name: /adicionar e continuar/i }));

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    const arg = issue.mock.calls[0][0];
    expect(arg).toMatchObject({
      ref: '05/2026',
      valueCents: 20000,
      dueDate: '2026-05-10',
      method: 'dinheiro',
    });
    expect(typeof arg.paidAt).toBe('string');
  });

  test('Concluir closes the card', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<NewReceiptCard dueDay={15} issue={jest.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /concluir/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

> `MoneyInput` renders an input labelled "Valor" and reports cents; typing "15000" yields 15000 cents — confirm by reading `shared/ui/money-input.tsx` and its test if the typing interaction differs, and adjust the test's value entry accordingly (keep the asserted `valueCents`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web test new-receipt-card`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// apps/web/src/features/residents/ui/new-receipt-card.tsx
import { useState, type ChangeEvent } from 'react';

import { dueDateFromRef } from '@/features/receipts/domain/due-date';
import { fileToDataUrl, isAllowedProof } from '@/features/receipts/domain/proof';
import type { ReceiptMethod } from '@/features/receipts/domain/receipt';
import { Icon } from '@/shared/ui/icon';
import { MoneyInput } from '@/shared/ui/money-input';

type IssueInput = {
  ref: string;
  valueCents: number;
  dueDate: string;
  paidAt?: string;
  method?: ReceiptMethod;
  proofDataUrl?: string;
};

type Props = {
  dueDay: number;
  issue: (input: IssueInput) => Promise<void>;
  onClose: () => void;
};

const METHODS: { value: ReceiptMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
];

const STATUSES: { paid: boolean; label: string }[] = [
  { paid: false, label: 'Pendente' },
  { paid: true, label: 'Pago' },
];

export function NewReceiptCard({ dueDay, issue, onClose }: Props) {
  const [ref, setRef] = useState('');
  const [valueCents, setValueCents] = useState(0);
  const [paid, setPaid] = useState(false);
  const [method, setMethod] = useState<ReceiptMethod>('dinheiro');
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dueDate = dueDateFromRef(ref, dueDay);

  const reset = () => {
    setRef('');
    setValueCents(0);
    setPaid(false);
    setMethod('dinheiro');
    setProofDataUrl(null);
    setProofName(null);
  };

  const attach = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (!isAllowedProof(dataUrl)) {
      setError('Comprovante inválido: envie imagem ou PDF.');
      return;
    }
    setError(null);
    setProofDataUrl(dataUrl);
    setProofName(file.name);
  };

  const save = async () => {
    if (dueDate === null) {
      setError('Competência inválida. Use MM/AAAA.');
      return;
    }
    if (valueCents <= 0 || pending) {
      setError('Informe um valor maior que zero.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await issue({
        ref: ref.trim(),
        valueCents,
        dueDate,
        ...(paid ? { paidAt: today, method, ...(proofDataUrl ? { proofDataUrl } : {}) } : {}),
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar o recibo.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px dashed var(--petrol-500)',
        borderRadius: 'var(--r-md)',
        padding: 14,
        marginBottom: 10,
        boxShadow: 'var(--sh-1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontWeight: 700,
            fontSize: '.78rem',
            letterSpacing: '.03em',
            textTransform: 'uppercase',
            color: 'var(--petrol-700)',
          }}
        >
          <Icon name="plus" size={15} strokeWidth={2.2} />
          Novo recibo
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            borderRadius: 'var(--r-sm)',
            background: 'transparent',
            color: 'var(--ink-500)',
            cursor: 'pointer',
          }}
        >
          <Icon name="x" size={17} />
        </button>
      </div>

      <label
        style={{
          display: 'block',
          fontWeight: 600,
          fontSize: '.8rem',
          marginBottom: 5,
          color: 'var(--ink-700)',
        }}
      >
        Competência
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="04/2026"
          aria-label="Competência"
          style={{
            width: '100%',
            minHeight: 44,
            marginTop: 5,
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            padding: '0 12px',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.94rem',
            color: 'var(--ink-900)',
            background: 'var(--surface-2)',
          }}
        />
      </label>

      <div style={{ marginTop: 11 }}>
        <MoneyInput label="Valor" value={valueCents} onChange={setValueCents} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 11 }}>
        {STATUSES.map((s) => {
          const active = paid === s.paid;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setPaid(s.paid)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 'var(--r-sm)',
                border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                background: active ? 'var(--petrol-50)' : 'var(--surface)',
                color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '.86rem',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {paid && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 11 }}>
            {METHODS.map((m) => {
              const active = method === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  style={{
                    flex: 1,
                    minHeight: 38,
                    borderRadius: 'var(--r-sm)',
                    border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                    background: active ? 'var(--petrol-50)' : 'var(--surface)',
                    color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '.84rem',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 42,
              marginBottom: 11,
              border: '1.5px dashed var(--petrol-500)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--petrol-50)',
              color: 'var(--petrol-800)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '.86rem',
              cursor: 'pointer',
            }}
          >
            {proofName ? `Comprovante: ${proofName}` : 'Anexar comprovante'}
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => void attach(e)}
              style={{ display: 'none' }}
            />
          </label>
        </>
      )}

      {error && (
        <p
          role="alert"
          style={{ color: 'var(--atraso-700)', margin: '0 0 10px', fontSize: '.86rem' }}
        >
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          style={{
            flex: 1,
            minHeight: 44,
            border: 'none',
            borderRadius: 'var(--r-sm)',
            background: 'var(--brass-500)',
            color: 'var(--petrol-900)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.92rem',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Adicionando…' : 'Adicionar e continuar'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 'none',
            minHeight: 44,
            padding: '0 16px',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface)',
            color: 'var(--ink-700)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.92rem',
            cursor: 'pointer',
          }}
        >
          Concluir
        </button>
      </div>
      <div
        style={{ fontSize: '.78rem', color: 'var(--ink-500)', marginTop: 9, textAlign: 'center' }}
      >
        O card permanece aberto para você lançar vários recibos em sequência.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web test new-receipt-card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/residents/ui/new-receipt-card.tsx apps/web/src/features/residents/ui/new-receipt-card.test.tsx
git commit -m "feat(web): inline new-receipt card component"
```

---

## Task 4: Web — wire the card in, remove the old screen

This task replaces the add-charge navigation with the inline card and deletes the old screen. It ends in a green, self-consistent state.

**Files:**

- Modify: `apps/web/src/app/container.ts`
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (+ `.test.tsx`)
- Modify: `apps/web/src/app/app.tsx`
- Modify: `apps/web/src/app/nav-store.ts`
- Delete: `apps/web/src/features/residents/ui/issue-charge-screen.tsx`, `apps/web/src/features/residents/ui/issue-charge-screen.test.tsx`

**Interfaces:**

- Consumes: `NewReceiptCard` (Task 3); `useSettings` from `@/features/settings/ui/use-settings`.

- [ ] **Step 1: Container passthrough**

In `container.ts`, extend `issueCharge`'s input type with `proofDataUrl?: string` (the `apiClient.post('/api/receipts', input)` body already forwards everything — just widen the type):

```ts
export async function issueCharge(input: {
  residentId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
  paidAt?: string;
  method?: 'dinheiro' | 'pix';
  proofDataUrl?: string;
}): Promise<void> {
  await apiClient.post('/api/receipts', input);
}
```

- [ ] **Step 2: Write the failing resident-edit test** (append to `resident-edit-screen.test.tsx`; reuse its existing imports/helpers — read the top of the file)

```tsx
test('the Adicionar button opens the inline new-receipt card (no navigation)', async () => {
  const user = userEvent.setup();
  const repository = new InMemoryResidentRepository([
    buildResident({
      id: 'r-1',
      name: 'Maria Ribeiro',
      apt: 'Apto 302',
      apartmentId: 'apt-1',
      active: true,
    }),
  ]);
  const issueCharge = jest.fn().mockResolvedValue(undefined);
  renderWithClient(
    <ResidentEditScreen
      repository={repository}
      receiptRepository={new InMemoryReceiptRepository([])}
      residentId="r-1"
      dueDay={15}
      issueCharge={issueCharge}
      onBack={jest.fn()}
    />,
  );

  await user.click(await screen.findByRole('button', { name: /adicionar/i }));

  expect(screen.getByLabelText('Competência')).toBeInTheDocument();

  await user.type(screen.getByLabelText('Competência'), '04/2026');
  await user.type(screen.getByLabelText('Valor'), '15000');
  await user.click(screen.getByRole('button', { name: /adicionar e continuar/i }));

  await waitFor(() =>
    expect(issueCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: 'r-1',
        ref: '04/2026',
        title: 'Taxa condominial',
        valueCents: 15000,
        dueDate: '2026-04-15',
      }),
    ),
  );
});
```

> This assumes the card's `issue` is wired so `ResidentEditScreen` injects `residentId` + `title: 'Taxa condominial'` before calling the `issueCharge` prop. If the existing test file constructs `ResidentEditScreen` without `issueCharge`/`dueDay`, those props must be optional (see Step 3) so unrelated tests keep compiling.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @morada/web test resident-edit-screen`
Expected: FAIL — no "Competência" field (button still navigates / card absent).

- [ ] **Step 4: Wire the card into `resident-edit-screen.tsx`**

Add imports:

```tsx
import { NewReceiptCard } from './new-receipt-card';
```

Change the `Props` type: remove `onIssueCharge`; add `dueDay?: number` and an `issueCharge` callback:

```tsx
  dueDay?: number;
  issueCharge?: (input: {
    residentId: string; ref: string; title: string; valueCents: number; dueDate: string;
    paidAt?: string; method?: ReceiptMethod; proofDataUrl?: string;
  }) => Promise<void>;
```

Remove `onIssueCharge` from the destructure; add `dueDay = 15` and `issueCharge` there. Thread `dueDay` + an adapted `issue` into `ReceiptsSection` (replace the `onIssueCharge` prop it receives):

- In `ReceiptsSection`, replace the `onIssueCharge?: () => void` prop with:

```tsx
  dueDay: number;
  issue?: (input: { ref: string; valueCents: number; dueDate: string; paidAt?: string; method?: ReceiptMethod; proofDataUrl?: string }) => Promise<void>;
```

- Add local state `const [showNewReceipt, setShowNewReceipt] = useState(false);` in `ReceiptsSection`.
- Change the "Adicionar" button (currently `onClick={onIssueCharge}`) to `onClick={() => setShowNewReceipt(true)}`, and only render it when `issue` is defined.
- Right after the `SectionLabel`, render the card when open:

```tsx
{
  showNewReceipt && issue && (
    <NewReceiptCard dueDay={dueDay} issue={issue} onClose={() => setShowNewReceipt(false)} />
  );
}
```

In `ResidentEditScreen`, build the `issue` passed to `ReceiptsSection` so it injects `residentId` + title and invalidates the receipts list:

```tsx
const submitNewReceipt = issueCharge
  ? async (input: {
      ref: string;
      valueCents: number;
      dueDate: string;
      paidAt?: string;
      method?: ReceiptMethod;
      proofDataUrl?: string;
    }) => {
      await issueCharge({ residentId: residentId as string, title: 'Taxa condominial', ...input });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: residentsQueryKey });
    }
  : undefined;
```

Pass `dueDay={dueDay}` and `issue={submitNewReceipt}` to `<ReceiptsSection ... />` (dropping the old `onIssueCharge={onIssueCharge}`). `queryClient` and `residentsQueryKey` are already in scope in this file.

- [ ] **Step 5: Update `app.tsx`**

- Remove `import { IssueChargeScreen } from '@/features/residents/ui/issue-charge-screen';`.
- Add `import { useSettings } from '@/features/settings/ui/use-settings';`.
- At the top of the `App` component body, add: `const settings = useSettings(settingsRepository);` and `const dueDay = settings.data?.dueDay ?? 15;`.
- On the `<ResidentEditScreen .../>` render, remove `onIssueCharge={...}` and add `dueDay={dueDay}` and `issueCharge={issueCharge}`.
- Delete the `case 'a-resident-charge':` block (the one rendering `<IssueChargeScreen .../>`).

- [ ] **Step 6: Update `nav-store.ts`**

Remove `| 'a-resident-charge'` from the `View` union.

- [ ] **Step 7: Delete the old screen + its test**

```bash
git rm apps/web/src/features/residents/ui/issue-charge-screen.tsx apps/web/src/features/residents/ui/issue-charge-screen.test.tsx
```

- [ ] **Step 8: Run the affected tests, then the full suite**

Run: `pnpm --filter @morada/web test resident-edit-screen`
Expected: PASS.
Run: `pnpm --filter @morada/web test`
Expected: PASS — no references to `a-resident-charge` or `IssueChargeScreen` remain (grep to confirm: `grep -rn "a-resident-charge\|IssueChargeScreen" apps/web/src` returns nothing).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): replace add-charge screen with inline new-receipt card"
```

---

## Task 5: Final gates

- [ ] **Step 1: API gate**

Run: `make api-check`
Expected: PASS (lint, typecheck, tests ≥ 80%). This also exercises the Postgres receipt adapter contract, confirming a paid-with-proof receipt round-trips.

- [ ] **Step 2: Web gate**

Run: `make check`
Expected: PASS (typecheck, lint, prettier, tests ≥ 80%).

- [ ] **Step 3:** If web coverage dips below 80%, add a focused test for any uncovered `NewReceiptCard` branch (e.g. the proof-attach invalid path or the value-zero guard). Do not lower the threshold. Commit any added tests:

```bash
git add -A && git commit -m "test(web): cover remaining new-receipt-card branches"
```

---

## Self-review notes

- **Spec coverage:** API proofDataUrl → Task 1. Due-date helper → Task 2. Card → Task 3. Wiring + screen removal + container passthrough + dueDay from settings → Task 4. Gates → Task 5.
- **Spec refinement:** the spec proposed passing `settingsRepository` into `ResidentEditScreen`; the plan instead computes `dueDay` in `app.tsx` (via `useSettings`) and passes it as an optional `dueDay` prop — avoids a conditional hook and keeps existing resident-edit tests compiling. Both honor "derive due date from competência + condo due day".
- **Green intermediate:** Task 4 is one atomic change (wire + remove) so there is no half-migrated state.
- **Type consistency:** the `issue`/`issueCharge` input shapes (`ref`/`valueCents`/`dueDate`/`paidAt?`/`method?`/`proofDataUrl?`) match across the card, resident-edit, and container.
