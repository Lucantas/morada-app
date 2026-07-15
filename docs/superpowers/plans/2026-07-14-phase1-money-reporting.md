# Phase 1 — Money & Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the money-input mask, restrict payment methods to cash/pix, and make the condo summary + "contas pagas" report the current month — the first of three phases from the payments/status/summary spec.

**Architecture:** Vite + React 19 web (feature-first clean architecture, `ui → domain ← data`, lint-enforced boundaries) over a Hono + Postgres API (hexagonal `domain/app/adapters/platform`). Money is integer cents everywhere; dates are ISO `YYYY-MM-DD`. The condo summary is derived live from the ledger by `buildDashboardSummary` on the API; the web only holds its Zod schema and renders it.

**Tech Stack:** TypeScript strict, Zod, TanStack Query, Zustand, Jest + Testing Library (web) / Jest ts-jest (api, serial vs Postgres), pnpm workspaces, lefthook gates.

## Global Constraints

- TDD: a failing test precedes implementation, committed together.
- Coverage ≥ 80% (pre-push gate); domain near 100%.
- No `any`, no non-null assertions (`!`), no `console.*` — lint errors.
- Immutability: never mutate inputs; return new objects/arrays.
- Comments only when extremely necessary — no narration, no TODOs.
- Validate at boundaries with Zod; wrap infra errors in domain errors.
- `eslint-plugin-boundaries`: web `ui` may import `domain`, never another feature's `ui`; `domain` is pure TS. Never disable the rule.
- Conventional commits, small and atomic. Never `--no-verify`.
- Monetary values stored/transferred as integer cents (`value_cents` / `valueCents`).
- Payment methods domain vocabulary: `dinheiro`, `pix` (exact strings).

## Commands (reference)

- Web full gate: `make check` · web tests: `make test` · single web test file: `pnpm --filter @morada/web exec jest <path> -t "<name>"`
- API full gate: `make api-check` · api tests: `make api-test` (needs `make db-up`) · single api test: `pnpm --filter @morada/api exec jest <path> -t "<name>"`
- Format one file: `pnpm exec prettier --write <path>`

---

### Task 1: `MoneyInput` shared component (web)

A controlled currency field: fixed `R$` prefix, value in integer cents, digits fill from the right, no free text.

**Files:**

- Create: `apps/web/src/shared/ui/money-input.tsx`
- Test: `apps/web/src/shared/ui/money-input.test.tsx`

**Interfaces:**

- Consumes: `formatBRL(cents: number): string` from `@/shared/lib/money`.
- Produces: `MoneyInput(props: { label: string; value: number; onChange: (cents: number) => void; placeholder?: string })` — a React component; `value`/`onChange` speak integer cents.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/shared/ui/money-input.test.tsx
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { MoneyInput } from './money-input';

function Harness() {
  const [cents, setCents] = useState(0);
  return (
    <>
      <MoneyInput label="Valor" value={cents} onChange={setCents} />
      <output data-testid="cents">{cents}</output>
    </>
  );
}

function input(): HTMLInputElement {
  return screen.getByLabelText('Valor') as HTMLInputElement;
}

describe('MoneyInput', () => {
  it('renders the label, a fixed R$ prefix and starts at 0,00', () => {
    render(<Harness />);
    expect(screen.getByText('R$')).toBeInTheDocument();
    expect(input().value).toBe('0,00');
    expect(screen.getByTestId('cents').textContent).toBe('0');
  });

  it('fills cents from the right as digits are typed', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '150' } });
    expect(screen.getByTestId('cents').textContent).toBe('150');
    expect(input().value).toBe('1,50');

    fireEvent.change(input(), { target: { value: '150000' } });
    expect(screen.getByTestId('cents').textContent).toBe('150000');
    expect(input().value).toBe('1.500,00');
  });

  it('keeps only digits when pasting a formatted amount', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: 'R$ 1.234,56' } });
    expect(screen.getByTestId('cents').textContent).toBe('123456');
    expect(input().value).toBe('1.234,56');
  });

  it('goes back to zero when the field is cleared', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '999' } });
    fireEvent.change(input(), { target: { value: '' } });
    expect(screen.getByTestId('cents').textContent).toBe('0');
    expect(input().value).toBe('0,00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/shared/ui/money-input.test.tsx`
Expected: FAIL — cannot find module `./money-input`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/shared/ui/money-input.tsx
import type { ChangeEvent } from 'react';

import { formatBRL } from '@/shared/lib/money';

type Props = {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  placeholder?: string;
};

export function MoneyInput({ label, value, onChange, placeholder }: Props) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '');
    onChange(digits === '' ? 0 : Number.parseInt(digits, 10));
  };

  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span
        style={{
          display: 'block',
          fontWeight: 600,
          fontSize: '.9rem',
          marginBottom: 7,
          color: 'var(--ink-900)',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 50,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '0 15px',
          background: 'var(--surface)',
        }}
      >
        <span style={{ color: 'var(--ink-500)', fontSize: '1rem', fontWeight: 600 }}>R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatBRL(value)}
          placeholder={placeholder}
          onChange={handleChange}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: "'Inter', sans-serif",
            fontSize: '1rem',
            color: 'var(--ink-900)',
            textAlign: 'right',
          }}
        />
      </div>
    </label>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @morada/web exec jest src/shared/ui/money-input.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/ui/money-input.tsx apps/web/src/shared/ui/money-input.test.tsx
git commit -m "feat(web): add MoneyInput currency field with fixed R\$ prefix"
```

---

### Task 2: Use `MoneyInput` in `IssueChargeScreen`

Replace the free-text "Valor (R$)" field (parsed on submit) with `MoneyInput`; hold the value as cents.

**Files:**

- Modify: `apps/web/src/features/residents/ui/issue-charge-screen.tsx`
- Test: `apps/web/src/features/residents/ui/issue-charge-screen.test.tsx` (create if absent)

**Interfaces:**

- Consumes: `MoneyInput` from Task 1; existing `issue(input: { residentId; ref; title; valueCents; dueDate }) => Promise<void>` prop (unchanged).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/residents/ui/issue-charge-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { IssueChargeScreen } from './issue-charge-screen';

describe('IssueChargeScreen', () => {
  it('submits the typed amount as integer cents', async () => {
    const issue = jest.fn().mockResolvedValue(undefined);
    render(
      <IssueChargeScreen residentId="r-1" residentName="Fulana" issue={issue} onBack={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: '05/2026' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '45000' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-05-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    expect(issue).toHaveBeenCalledWith({
      residentId: 'r-1',
      ref: '05/2026',
      title: 'Taxa condominial',
      valueCents: 45000,
      dueDate: '2026-05-15',
    });
  });

  it('blocks submit when the amount is zero', () => {
    const issue = jest.fn();
    render(<IssueChargeScreen residentId="r-1" issue={issue} onBack={() => {}} />);

    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: '05/2026' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-05-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(issue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha referência, valor e vencimento.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/residents/ui/issue-charge-screen.test.tsx`
Expected: FAIL — `getByLabelText('Valor')` not found (field still labelled "Valor (R$)" and value is a string).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/features/residents/ui/issue-charge-screen.tsx`:

1. Add the import near the other `@/shared/ui` imports:

```tsx
import { MoneyInput } from '@/shared/ui/money-input';
```

2. Delete the `parseReaisToCents` helper (lines 24-27) entirely.

3. Change the amount state from string to cents:

```tsx
const [valueCents, setValueCents] = useState(0);
```

(replace `const [valor, setValor] = useState('');`)

4. Replace the `submit` body's first lines so it no longer parses:

```tsx
const submit = async () => {
  if (!ref.trim() || !dueDate || valueCents <= 0) {
    setError('Preencha referência, valor e vencimento.');
    return;
  }
  if (pending) return;
  setPending(true);
  setError(null);
  try {
    await issue({ residentId, ref: ref.trim(), title: TITLE, valueCents, dueDate });
    setDone(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Não foi possível adicionar o recibo.');
  } finally {
    setPending(false);
  }
};
```

5. Replace the value `Field` (the line with `label="Valor (R$)"`) with:

```tsx
<MoneyInput label="Valor" value={valueCents} onChange={setValueCents} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morada/web exec jest src/features/residents/ui/issue-charge-screen.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/residents/ui/issue-charge-screen.tsx apps/web/src/features/residents/ui/issue-charge-screen.test.tsx
git commit -m "feat(web): use MoneyInput for the add-charge amount"
```

---

### Task 3: Use `MoneyInput` in `AccountEditScreen`

Same swap for the account editor; drop the now-unused reais parser if nothing else imports it.

**Files:**

- Modify: `apps/web/src/features/accounts/ui/account-edit-screen.tsx`
- Test: `apps/web/src/features/accounts/ui/account-edit-screen.test.tsx` (create if absent)
- Possibly delete: `apps/web/src/features/accounts/domain/parse-reais-to-cents.ts` (+ its test) if unused after this task.

**Interfaces:**

- Consumes: `MoneyInput` from Task 1; existing `useSaveAccount` mutation expecting `{ ...rest, date, valueCents, id }`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/accounts/ui/account-edit-screen.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { AccountRepository } from '../domain/account-repository';
import { AccountEditScreen } from './account-edit-screen';

function makeRepo(): { repo: AccountRepository; saved: unknown[] } {
  const saved: unknown[] = [];
  const repo = {
    list: async () => [],
    getById: async () => null,
    save: async (account: unknown) => {
      saved.push(account);
      return account;
    },
  } as unknown as AccountRepository;
  return { repo, saved };
}

function renderScreen(repo: AccountRepository) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccountEditScreen repository={repo} onBack={() => {}} />
    </QueryClientProvider>,
  );
}

describe('AccountEditScreen', () => {
  it('saves the typed amount as integer cents', async () => {
    const { repo, saved } = makeRepo();
    renderScreen(repo);

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Água — abril' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Utilidades' } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-04-25' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '124000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar conta' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ valueCents: 124000, date: '2026-04-25', status: 'pendente' });
  });
});
```

(Adjust the `makeRepo` shape to match the real `AccountRepository` interface in `apps/web/src/features/accounts/domain/account-repository.ts` — read it first and mirror its method names.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/accounts/ui/account-edit-screen.test.tsx`
Expected: FAIL — `getByLabelText('Valor')` not found (field is "Valor (R$)" and value is a formatted string).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/features/accounts/ui/account-edit-screen.tsx`:

1. Swap imports: remove `import { formatBRL } from '@/shared/lib/money';` and `import { parseReaisToCents } from '../domain/parse-reais-to-cents';`; add:

```tsx
import { MoneyInput } from '@/shared/ui/money-input';
```

2. Change `EMPTY` to hold cents:

```tsx
const EMPTY = {
  description: '',
  category: '',
  date: '',
  valueCents: 0,
  status: 'pendente' as AccountStatus,
};
```

3. In the `useEffect` that hydrates from `existing.data`, set cents directly:

```tsx
useEffect(() => {
  if (existing.data) {
    const { description, category, date, valueCents, status } = existing.data;
    setForm({ description, category, date: date ?? '', valueCents, status });
  }
}, [existing.data]);
```

4. In `submit`, drop the parse:

```tsx
const submit = () => {
  const { valueCents, date, ...rest } = form;
  save.mutate(
    { ...rest, date: date === '' ? null : date, valueCents, id: accountId },
    { onSuccess: onBack },
  );
};
```

5. Replace the value `Field` (label `"Valor (R$)"`) with:

```tsx
<MoneyInput
  label="Valor"
  value={form.valueCents}
  onChange={(cents) => setForm((prev) => ({ ...prev, valueCents: cents }))}
/>
```

6. Check whether `parseReaisToCents` is still imported anywhere:

```bash
grep -rn "parse-reais-to-cents\|parseReaisToCents" apps/web/src
```

If the only remaining hits are its own file + test, delete both:

```bash
git rm apps/web/src/features/accounts/domain/parse-reais-to-cents.ts apps/web/src/features/accounts/domain/parse-reais-to-cents.test.ts
```

(If other callers remain, leave the file in place.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morada/web exec jest src/features/accounts`
Expected: PASS (including the new screen test; the parse-reais test is gone only if it was deleted).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/accounts
git commit -m "feat(web): use MoneyInput for account amount; drop reais text parser"
```

---

### Task 4: Restrict payment methods to `dinheiro` & `pix`

Change the method enum web+api, migrate legacy `boleto`/`cartao` rows to `dinheiro`, and update every call site (labels, pickers, fixtures, tests).

**Files:**

- Modify (api): `apps/api/src/receipts/domain/receipt.ts`, `apps/api/src/receipts/adapters/http/routes.ts:14`, `apps/api/src/receipts/adapters/receipt-repository.contract.ts:62,67`, `apps/api/src/receipts/app/pay-receipt.test.ts:41`, `apps/api/src/test-fixtures.ts:108,134`, `apps/api/src/platform/postgres/migrations.ts`
- Modify (web): `apps/web/src/features/receipts/domain/receipt.ts`, `apps/web/src/app/container.ts:58`, `apps/web/src/features/receipts/domain/pay-receipt.test.ts:23,32`, `apps/web/src/features/receipts/domain/pending-receipt.test.ts:20`, `apps/web/src/features/receipts/ui/receipt-status-view.ts:10-14`, `apps/web/src/features/receipts/ui/receipt-status-view.test.ts:16-17`, `apps/web/src/features/receipts/ui/pay-screen.tsx:18,32`, `apps/web/src/features/receipts/ui/pay-screen.test.tsx:36`, `apps/web/src/features/residents/ui/resident-edit-screen.tsx:317-318,390`

**Interfaces:**

- Produces: `receiptMethodSchema = z.enum(['dinheiro', 'pix'])` (web + api); `type ReceiptMethod = 'dinheiro' | 'pix'`; `methodLabel('dinheiro') === 'Dinheiro'`, `methodLabel('pix') === 'Pix'`.

- [ ] **Step 1: Write the failing tests**

Update `apps/web/src/features/receipts/ui/receipt-status-view.test.ts` lines 16-17 to:

```ts
expect(methodLabel('dinheiro')).toBe('Dinheiro');
expect(methodLabel('pix')).toBe('Pix');
```

Add to `apps/web/src/features/receipts/domain/receipt.test.ts` (create if absent) a rejection test:

```ts
import { receiptMethodSchema } from './receipt';

describe('receiptMethodSchema', () => {
  it('accepts dinheiro and pix', () => {
    expect(receiptMethodSchema.parse('dinheiro')).toBe('dinheiro');
    expect(receiptMethodSchema.parse('pix')).toBe('pix');
  });

  it('rejects boleto and cartao', () => {
    expect(() => receiptMethodSchema.parse('boleto')).toThrow();
    expect(() => receiptMethodSchema.parse('cartao')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @morada/web exec jest src/features/receipts/domain/receipt.test.ts src/features/receipts/ui/receipt-status-view.test.ts`
Expected: FAIL — schema still accepts `boleto`; `methodLabel('dinheiro')` is `undefined`.

- [ ] **Step 3: Write the implementation**

**API:**

`apps/api/src/receipts/domain/receipt.ts` line 6:

```ts
export const receiptMethodSchema = z.enum(['dinheiro', 'pix']);
```

`apps/api/src/receipts/adapters/http/routes.ts` line 14:

```ts
method: z.enum(['dinheiro', 'pix']),
```

`apps/api/src/receipts/adapters/receipt-repository.contract.ts` lines 62 and 67: replace `'cartao'` with `'dinheiro'` (both the input and the expectation).

`apps/api/src/receipts/app/pay-receipt.test.ts` line 41: `await payReceipt(repo, 'r-1', 'dinheiro');` (update any following assertion on the method accordingly).

`apps/api/src/test-fixtures.ts` lines 108 and 134: change `method: 'boleto'` to `method: 'dinheiro'`.

Append a migration to `apps/api/src/platform/postgres/migrations.ts` (after the `002_dates` entry, inside the array):

```ts
  {
    id: '003_payment_methods',
    sql: `
UPDATE receipts SET method = 'dinheiro' WHERE method IN ('boleto', 'cartao');
`,
  },
```

**Web:**

`apps/web/src/features/receipts/domain/receipt.ts` line 6:

```ts
export const receiptMethodSchema = z.enum(['dinheiro', 'pix']);
```

`apps/web/src/app/container.ts` line 58:

```ts
method: 'dinheiro' | 'pix';
```

`apps/web/src/features/receipts/domain/pay-receipt.test.ts`: line 23 `'boleto'` → `'dinheiro'`; line 32 `'cartao'` → `'pix'` (and any method assertion that follows).

`apps/web/src/features/receipts/domain/pending-receipt.test.ts` line 20: `method: 'boleto'` → `method: 'dinheiro'`.

`apps/web/src/features/receipts/ui/receipt-status-view.ts` lines 10-14:

```ts
const METHOD_LABELS: Record<ReceiptMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
};
```

`apps/web/src/features/receipts/ui/pay-screen.tsx`: line 18 `const METHODS: ReceiptMethod[] = ['dinheiro', 'pix'];`; line 32 default `useState<ReceiptMethod>('pix')` (leave `'pix'` — valid).

`apps/web/src/features/receipts/ui/pay-screen.test.tsx` line 36: `expect(saved?.method).toBe('dinheiro');` and make the test click the "Dinheiro" method button before confirming (replace the boleto selection).

`apps/web/src/features/residents/ui/resident-edit-screen.tsx`: lines 317-318 — replace the two `{ value: 'boleto' ... }` / `{ value: 'cartao' ... }` entries with a single `{ value: 'dinheiro', label: 'Dinheiro' }` (keep the existing `pix` entry); line 390 default `useState<ReceiptMethod>('dinheiro')`.

- [ ] **Step 4: Run both suites to verify green**

Run: `make db-up && make api-test`
Expected: PASS (all api tests; the migration is applied on the test DB boot).
Run: `make test`
Expected: PASS (all web tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts apps/api/src/test-fixtures.ts apps/api/src/platform/postgres/migrations.ts apps/web/src/features/receipts apps/web/src/features/residents/ui/resident-edit-screen.tsx apps/web/src/app/container.ts
git commit -m "feat: accept only dinheiro and pix; migrate legacy methods to dinheiro"
```

---

### Task 5: Month-aware condo summary (API computation)

Keep `Saldo do condomínio` all-time; redefine `incomeCents` = this month's paid receipts (by `paidAt`) and `paidCents` = this month's paid accounts (by `date`). Schema shape is unchanged — only the meaning of two fields and the inputs change.

**Files:**

- Modify: `apps/api/src/dashboard/domain/build-dashboard-summary.ts`
- Modify: `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts`
- Test: `apps/api/src/dashboard/domain/build-dashboard-summary.test.ts` (update existing)
- Update call sites that pass receipts/`today` (see Step 3.d).

**Interfaces:**

- Produces: `buildDashboardSummary(accounts: LedgerAccount[], receipts: LedgerReceipt[], today: string): DashboardSummary` where `LedgerReceipt = { valueCents: number; status: string; paidAt: string | null }`. `balance.balanceCents` = all-time paid receipts − all-time paid accounts; `balance.incomeCents` = current-month paid receipts by `paidAt`; `balance.paidCents` = current-month paid accounts by `date`. `today` is ISO `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing test**

Replace the body of `apps/api/src/dashboard/domain/build-dashboard-summary.test.ts` with (keep any existing recentPaid/maintenances cases, adding `paidAt` to receipt inputs and a `today` argument):

```ts
import { buildDashboardSummary } from './build-dashboard-summary';

const TODAY = '2026-07-14';

describe('buildDashboardSummary — month-aware balance', () => {
  it('balance is all-time; income and paid are current-month only', () => {
    const accounts = [
      {
        id: 'a1',
        description: 'Água',
        category: 'Utilidades',
        date: '2026-07-05',
        valueCents: 8000,
        status: 'pago',
      },
      {
        id: 'a2',
        description: 'Energia',
        category: 'Utilidades',
        date: '2026-06-30',
        valueCents: 5000,
        status: 'pago',
      },
      {
        id: 'a3',
        description: 'Reforma',
        category: 'Obras',
        date: '2026-07-10',
        valueCents: 3000,
        status: 'pendente',
      },
    ];
    const receipts = [
      { valueCents: 15000, status: 'pago', paidAt: '2026-07-02' },
      { valueCents: 15000, status: 'pago', paidAt: '2026-06-20' },
      { valueCents: 15000, status: 'pendente', paidAt: null },
    ];

    const summary = buildDashboardSummary(accounts, receipts, TODAY);

    // all-time: income 30000 (two paid receipts) - paid accounts 13000 = 17000
    expect(summary.balance.balanceCents).toBe(17000);
    // this month (2026-07): one paid receipt of 15000
    expect(summary.balance.incomeCents).toBe(15000);
    // this month (2026-07): one paid account of 8000
    expect(summary.balance.paidCents).toBe(8000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/api exec jest src/dashboard/domain/build-dashboard-summary.test.ts`
Expected: FAIL — `buildDashboardSummary` takes two args / `paidCents` is all-time.

- [ ] **Step 3: Write the implementation**

**3.a — `apps/api/src/dashboard/domain/build-dashboard-summary.ts`:** add `paidAt` to `LedgerReceipt`, a `sameMonth` helper, and the `today` parameter. Replace the interface and the `buildDashboardSummary` function:

```ts
export interface LedgerReceipt {
  valueCents: number;
  status: string;
  paidAt: string | null;
}

function sameMonth(iso: string | null, today: string): boolean {
  return iso !== null && iso.slice(0, 7) === today.slice(0, 7);
}

export function buildDashboardSummary(
  accounts: LedgerAccount[],
  receipts: LedgerReceipt[],
  today: string,
): DashboardSummary {
  const paidAccounts = accounts.filter((a) => a.status === PAID);
  const paidReceipts = receipts.filter((r) => r.status === PAID);

  const allTimeIncome = sum(paidReceipts);
  const allTimePaid = sum(paidAccounts);
  const monthIncome = sum(paidReceipts.filter((r) => sameMonth(r.paidAt, today)));
  const monthPaid = sum(paidAccounts.filter((a) => sameMonth(a.date, today)));

  const recentPaid = [...paidAccounts]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, RECENT_PAID_LIMIT)
    .map((a) => ({
      id: a.id,
      label: a.description,
      dateLabel: a.date ? `Paga em ${formatBrDate(a.date)}` : 'Paga',
      valueCents: a.valueCents,
      icon: iconForAccount(a),
    }));

  const maintenances = accounts
    .filter((a) => /manuten/i.test(a.category))
    .map((a) => ({
      id: a.id,
      title: a.description,
      detail: `${STATUS_LABELS[a.status] ?? a.status}${a.date ? ` · ${formatBrDate(a.date)}` : ''}`,
      icon: 'wrench' as const,
    }));

  return dashboardSummarySchema.parse({
    balance: {
      balanceCents: allTimeIncome - allTimePaid,
      incomeCents: monthIncome,
      paidCents: monthPaid,
    },
    recentPaid,
    maintenances,
  });
}
```

**3.b — `apps/api/src/dashboard/adapters/postgres/dashboard-repository.ts`:** select `paid_at`, map it, and pass `today`. Change `ReceiptRow`, the receipts query, the mapping, and the call:

```ts
interface ReceiptRow {
  value_cents: number;
  status: string;
  paid_at: string | null;
}
```

```ts
const receiptsResult = await this.pool.query<ReceiptRow>(
  'SELECT value_cents, status, paid_at::text AS paid_at FROM receipts',
);
const receipts: LedgerReceipt[] = receiptsResult.rows.map((row) => ({
  valueCents: row.value_cents,
  status: row.status,
  paidAt: row.paid_at,
}));

const today = new Date().toISOString().slice(0, 10);
return buildDashboardSummary(accounts, receipts, today);
```

**3.c — in-memory dashboard repo (if one exists for HTTP route tests):** search and update any other `buildDashboardSummary(` call and any `LedgerReceipt` literal:

```bash
grep -rn "buildDashboardSummary(\|LedgerReceipt" apps/api/src
```

For each additional caller, pass a `today` (e.g. `new Date().toISOString().slice(0, 10)`, or a fixed date in tests) and add `paidAt` to receipt inputs (use `null` where unpaid, an ISO date where paid).

**3.d — other tests referencing the old 2-arg signature** (`get-dashboard-summary.test.ts`, `dashboard-repository.contract.ts`, `routes.test.ts`): update receipt fixtures to include `paidAt` and any direct `buildDashboardSummary` call to pass `today`. Run the grep from 3.c to find them all.

- [ ] **Step 4: Run the api suite to verify green**

Run: `make db-up && make api-test`
Expected: PASS (all api tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard
git commit -m "feat(api): report current-month income and paid accounts in the condo summary"
```

---

### Task 6: Month wording on the summary widgets (web)

The admin hero already labels "Entradas do mês"; align "Contas pagas" and the resident hero so the month scope is explicit. Data already comes month-scoped from Task 5.

**Files:**

- Modify: `apps/web/src/features/dashboard/ui/dashboard-screen.tsx` (label near line 182)
- Modify: `apps/web/src/features/resident-home/ui/resident-finance-screen.tsx` (labels near lines 83 and 89)

**Interfaces:**

- Consumes: `DashboardSummary.balance` from Task 5 (unchanged shape).

- [ ] **Step 1: Write the failing test**

Add `apps/web/src/features/resident-home/ui/resident-finance-labels.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { ResidentFinanceScreen } from './resident-finance-screen';

jest.mock('./use-resident-finance', () => ({
  useResidentFinance: () => ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: {
      balance: { balanceCents: 500000, incomeCents: 30000, paidCents: 8000 },
      recentPaid: [],
      maintenances: [],
    },
  }),
}));

describe('ResidentFinanceScreen labels', () => {
  it('scopes entradas and contas pagas to the month', () => {
    render(<ResidentFinanceScreen dashboardRepository={{} as never} bottomNav={null} />);
    expect(screen.getByText('Entradas do mês')).toBeInTheDocument();
    expect(screen.getByText('Contas pagas do mês')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/resident-home/ui/resident-finance-labels.test.tsx`
Expected: FAIL — labels read "Entradas" and "Contas pagas".

- [ ] **Step 3: Write the implementation**

In `apps/web/src/features/resident-home/ui/resident-finance-screen.tsx`: change the label text `Entradas` → `Entradas do mês` (near line 83) and `Contas pagas` → `Contas pagas do mês` (near line 89).

In `apps/web/src/features/dashboard/ui/dashboard-screen.tsx`: change the label text `Contas pagas` → `Contas pagas do mês` (near line 182). ("Entradas do mês" already correct.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morada/web exec jest src/features/resident-home src/features/dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/dashboard/ui/dashboard-screen.tsx apps/web/src/features/resident-home/ui/resident-finance-screen.tsx apps/web/src/features/resident-home/ui/resident-finance-labels.test.tsx
git commit -m "feat(web): label condo summary entries as current-month"
```

---

## Phase 1 done — final gate

- [ ] Run the full gates before opening a PR:

```bash
make check        # web: typecheck + lint + prettier + tests (coverage ≥ 80%)
make db-up && make api-check   # api: typecheck + lint + tests
```

Expected: both green. This closes spec items 1 (money mask), 3 (dinheiro/pix), 7 (contas do mês) and 8 (month-aware summary). Phases 2 (receipts admin + monthly generation) and 3 (payment workflow + status override) get their own plans.

## Self-review notes

- **Spec coverage:** item 1 → Tasks 1-3; item 3 → Task 4; item 7 → Task 5 (`paidCents` month filter); item 8 → Tasks 5-6. Items 2, 4, 5, 6 are Phases 2-3 (out of scope here, by design).
- **Type consistency:** `MoneyInput({ value, onChange })` speaks cents in Tasks 1-3; `receiptMethodSchema`/`ReceiptMethod` are `'dinheiro' | 'pix'` across web+api in Task 4; `buildDashboardSummary(accounts, receipts, today)` and `LedgerReceipt.paidAt` are consistent between Task 5's definition and its callers.
- **No placeholders:** every step shows the concrete edit; the two grep-driven steps (3.c/3.d in Task 5, parser removal in Task 3) are conditional cleanups with exact commands, not vague "handle the rest".
