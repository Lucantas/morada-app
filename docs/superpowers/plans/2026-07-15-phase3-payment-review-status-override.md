# Phase 3 — Payment review (proof + confirm/reject) & admin status override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a resident submit a payment with a proof attachment (moving the receipt to `em_analise`, never straight to `pago`), let only the admin confirm (→ `pago`) or reject (→ `pendente`), and let the admin override a resident's derived payment status.

**Architecture:** Hono + Postgres API (hexagonal) + Vite/React 19 web (feature-first, lint-enforced boundaries). Adds a third receipt status `em_analise` and two receipt columns (`submitted_at`, `proof_data_url`); proof is a base64 data URL stored inline for now (a later swap to object storage keeps the domain unchanged). Adds a nullable `residents.status_override` that wins over the derived status when set. The resident pay path becomes "submit for review"; the admin gains confirm/reject; the admin's existing direct "Dar baixa" (`POST /:id/pay`) is preserved but tightened to admin-only.

**Tech Stack:** TypeScript strict, Zod, TanStack Query, Zustand, Jest (ts-jest api / Testing Library web), node-pg, pnpm, lefthook.

## Global Constraints

- TDD: a failing test precedes implementation, committed together.
- Coverage ≥ 80% (pre-push gate); domain near 100%.
- No `any`, no non-null assertions (`!`), no `console.*` — lint errors.
- Immutability: never mutate inputs; return new objects/arrays.
- Comments only when extremely necessary — no narration, no TODOs.
- Validate at boundaries with Zod; wrap infra errors in domain errors.
- `eslint-plugin-boundaries`: api domain pure (zod/`node:crypto` only), app orchestrates domains, adapters implement ports; web `ui → domain ← data`, never another feature's `ui`. Never disable.
- Conventional commits (lowercase subject; no leading `POST`/`PUT`), small and atomic. Never `--no-verify`.
- Receipt status vocabulary is exactly `pendente` · `em_analise` · `pago`. Resident status vocabulary is exactly `em_dia` · `pendente` · `atrasado`. Payment methods exactly `dinheiro` · `pix`.
- Migrations append-only; current last id is `004_condo_settings`, so the next is `005_receipt_review`, then `006_resident_status_override`. Never edit an existing migration.
- Proof is a data URL string (`data:<mime>;base64,<...>`), max ~5 MB; allowed MIME `image/*` or `application/pdf`.
- Only the admin may confirm/reject and may override status. Residents may only submit against their OWN receipt (the existing `denyForeignReceipt` ownership guard).

## Commands (reference)

- Web: full gate `make check` · tests `make test` · single `pnpm --filter @morada/web exec jest <path> -t "<name>"`
- API: full gate `make api-check` · tests `make db-up && make api-test` · single `pnpm --filter @morada/api exec jest <path> -t "<name>"`
- Format one file: `pnpm exec prettier --write <path>`
- API tasks touching migrations/adapters require `make db-up`.

---

### Task 1: Receipt review data layer — `em_analise` + proof columns (API)

Add the `em_analise` status and the `submitted_at`/`proof_data_url` columns end to end (schema, migration, pg adapter, contract).

**Files:**

- Modify: `apps/api/src/receipts/domain/receipt.ts` (status enum + two optional fields)
- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `005_receipt_review`)
- Modify: `apps/api/src/receipts/adapters/postgres/receipt-repository.ts` (columns, row, mapping, upsert)
- Modify: `apps/api/src/receipts/adapters/receipt-repository.contract.ts` (round-trip the new fields + em_analise)

**Interfaces:**

- Produces: `receiptStatusSchema = z.enum(['pendente', 'em_analise', 'pago'])`; `Receipt` gains `submittedAt?: string` (ISO) and `proofDataUrl?: string`. The pg adapter persists/round-trips both new columns.

- [ ] **Step 1: Extend the contract test (failing)**

In `apps/api/src/receipts/adapters/receipt-repository.contract.ts`, add a test to the existing contract function:

```ts
test('round-trips an em_analise receipt with proof and submittedAt', async () => {
  const repo = await makeRepo();
  const receipt = {
    id: 'rc-analise',
    ref: '07/2026',
    title: 'Taxa condominial',
    dueDate: '2026-07-15',
    valueCents: 15000,
    status: 'em_analise' as const,
    method: 'pix' as const,
    submittedAt: '2026-07-14',
    proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    residentId: 'r-1',
    apartmentId: 'apt-1',
  };
  await repo.save(receipt);
  expect(await repo.getById('rc-analise')).toEqual(receipt);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `make db-up && pnpm --filter @morada/api exec jest receipt-repository`
Expected: FAIL — schema rejects `em_analise` / new columns don't exist (INSERT error or the round-trip drops `submittedAt`/`proofDataUrl`).

- [ ] **Step 3: Implement**

`apps/api/src/receipts/domain/receipt.ts`:

- Line 3: `export const receiptStatusSchema = z.enum(['pendente', 'em_analise', 'pago']);`
- In `receiptSchema`, add after `paidAt`:

```ts
  submittedAt: isoDateSchema.optional(),
  proofDataUrl: z.string().max(7_000_000).optional(),
```

(≈5 MB binary ≈ 6.8 MB base64; 7e6 is a safe cap.)

Append to `apps/api/src/platform/postgres/migrations.ts` (after `004_condo_settings`):

```ts
  {
    id: '005_receipt_review',
    sql: `
ALTER TABLE receipts ADD COLUMN submitted_at DATE;
ALTER TABLE receipts ADD COLUMN proof_data_url TEXT;
`,
  },
```

`apps/api/src/receipts/adapters/postgres/receipt-repository.ts`:

- `INSERT_COLUMNS` → append `, submitted_at, proof_data_url`.
- `SELECT_COLUMNS` → append `, submitted_at::text AS submitted_at, proof_data_url`.
- `ReceiptRow` interface → add `submitted_at: string | null; proof_data_url: string | null;`.
- `toReceipt` → parse with `submittedAt: row.submitted_at ?? undefined, proofDataUrl: row.proof_data_url ?? undefined` (only include when non-null so optional fields stay absent, matching the schema — use a spread: `...(row.submitted_at ? { submittedAt: row.submitted_at } : {})`, likewise for proof).
- `save`: add `$11, $12` to the VALUES list and `receipt.submittedAt ?? null, receipt.proofDataUrl ?? null` to the params; add `submitted_at = EXCLUDED.submitted_at, proof_data_url = EXCLUDED.proof_data_url` to the `ON CONFLICT DO UPDATE SET`.

- [ ] **Step 4: Run to verify pass**

Run: `make db-up && pnpm --filter @morada/api exec jest receipt-repository`
Expected: PASS (incl. the new round-trip).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts/domain/receipt.ts apps/api/src/platform/postgres/migrations.ts apps/api/src/receipts/adapters/postgres/receipt-repository.ts apps/api/src/receipts/adapters/receipt-repository.contract.ts
git commit -m "feat(api): add em_analise status and receipt proof columns"
```

---

### Task 2: Resident submits a payment for review (API)

A resident submits their own receipt with a method + proof → `em_analise`; the existing direct `/pay` becomes admin-only so residents can't skip review.

**Files:**

- Create: `apps/api/src/receipts/app/submit-payment.ts`
- Create: `apps/api/src/receipts/app/submit-payment.test.ts`
- Modify: `apps/api/src/receipts/adapters/http/routes.ts` (add `POST /:id/submit-payment`; make `POST /:id/pay` admin-only)

**Interfaces:**

- Consumes: `ReceiptRepository` (`getById`, `save`); `receiptSchema`, `receiptMethodSchema`; `ReceiptNotFoundError`.
- Produces: `submitPayment(repo, id, input): Promise<Receipt>` where `input = { method, proofDataUrl }` → sets `status:'em_analise'`, `method`, `submittedAt: today`, `proofDataUrl`. Route `POST /api/receipts/:id/submit-payment` (resident, own receipt). `POST /api/receipts/:id/pay` now rejects non-admins (403).

- [ ] **Step 1: Write the failing test**

`apps/api/src/receipts/app/submit-payment.test.ts` (mirror the fake-repo shape used in `edit-receipt.test.ts`):

```ts
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { submitPayment } from './submit-payment';

function fakeRepo(seed: Receipt[]): ReceiptRepository {
  let rows = [...seed];
  return {
    list: async () => rows,
    listByResident: async (rid) => rows.filter((r) => r.residentId === rid),
    listByApartment: async (aid) => rows.filter((r) => r.apartmentId === aid),
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    save: async (r) => {
      rows = [...rows.filter((x) => x.id !== r.id), r];
      return r;
    },
  };
}

const pending: Receipt = {
  id: 'rc-1',
  ref: '07/2026',
  title: 'Taxa condominial',
  dueDate: '2026-07-15',
  valueCents: 15000,
  status: 'pendente',
  residentId: 'r-1',
  apartmentId: 'apt-1',
};

describe('submitPayment', () => {
  it('moves a pending receipt to em_analise with method, proof and submittedAt', async () => {
    const repo = fakeRepo([pending]);
    const result = await submitPayment(repo, 'rc-1', {
      method: 'pix',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      today: '2026-07-14',
    });
    expect(result).toMatchObject({
      id: 'rc-1',
      status: 'em_analise',
      method: 'pix',
      submittedAt: '2026-07-14',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
  });

  it('rejects an invalid proof mime', async () => {
    const repo = fakeRepo([pending]);
    await expect(
      submitPayment(repo, 'rc-1', {
        method: 'pix',
        proofDataUrl: 'data:text/plain;base64,aaa',
        today: '2026-07-14',
      }),
    ).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/api exec jest src/receipts/app/submit-payment.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`apps/api/src/receipts/app/submit-payment.ts`:

```ts
import { z } from 'zod';

import { ReceiptNotFoundError, ReceiptValidationError } from '../domain/errors';
import { receiptMethodSchema, receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

const proofSchema = z
  .string()
  .regex(/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i, 'Comprovante inválido')
  .max(7_000_000);

const inputSchema = z.object({
  method: receiptMethodSchema,
  proofDataUrl: proofSchema,
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function submitPayment(
  repo: ReceiptRepository,
  id: string,
  input: unknown,
): Promise<Receipt> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptValidationError('Dados do pagamento inválidos');
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const updated = receiptSchema.parse({
    ...existing,
    status: 'em_analise',
    method: parsed.data.method,
    submittedAt: parsed.data.today,
    proofDataUrl: parsed.data.proofDataUrl,
  });
  return repo.save(updated);
}
```

(Confirm the `ReceiptNotFoundError`/`ReceiptValidationError` constructor shapes in `receipts/domain/errors.ts` and match them.)

`apps/api/src/receipts/adapters/http/routes.ts`:

- Add, alongside the existing `POST /:id/pay` handler, a resident submit route (keep the `denyForeignReceipt` ownership guard):

```ts
app.post('/:id/submit-payment', async (c) => {
  const receipt = await getReceipt(repo, c.req.param('id'));
  const denied = denyForeignReceipt(c, receipt);
  if (denied) return denied;
  const body = await c.req.json();
  const today = new Date().toISOString().slice(0, 10);
  return c.json(await submitPayment(repo, c.req.param('id'), { ...body, today }));
});
```

- In the existing `POST /:id/pay` handler, add an admin gate at the top (after loading/ownership): `if (c.get('role') !== 'admin') return c.json({ error: 'Acesso negado' }, 403);` so residents can no longer mark themselves paid — they must submit for review.

Import `submitPayment` at the top of the routes file.

- [ ] **Step 4: Run to verify pass**

Run: `make db-up && make api-test`
Expected: PASS. (If a pre-existing test asserted a resident could `POST /:id/pay` → 200, update it to reflect the new 403 + the submit-payment path — do NOT delete coverage, adapt it.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts/app/submit-payment.ts apps/api/src/receipts/app/submit-payment.test.ts apps/api/src/receipts/adapters/http/routes.ts
git commit -m "feat(api): residents submit payments with proof for review"
```

---

### Task 3: Admin confirms or rejects a submitted payment (API)

**Files:**

- Create: `apps/api/src/receipts/app/confirm-payment.ts`
- Create: `apps/api/src/receipts/app/reject-payment.ts`
- Create: `apps/api/src/receipts/app/confirm-reject-payment.test.ts`
- Modify: `apps/api/src/compose.ts` (register admin routes before the `/receipts` mount)

**Interfaces:**

- Consumes: `ReceiptRepository` (`getById`, `save`); `receiptSchema`, `isoDateSchema`; `ReceiptNotFoundError`.
- Produces: `confirmPayment(repo, id, paidAt): Promise<Receipt>` → `status:'pago'`, sets `paidAt` (given or today), keeps `method`, clears nothing else. `rejectPayment(repo, id): Promise<Receipt>` → `status:'pendente'`, clears `proofDataUrl`, `submittedAt`, `method`, `paidAt`. Routes `POST /api/receipts/:id/confirm` and `POST /api/receipts/:id/reject` (admin).

- [ ] **Step 1: Write the failing test**

`apps/api/src/receipts/app/confirm-reject-payment.test.ts` (reuse a fake repo like Task 2 with an `em_analise` seed):

```ts
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { confirmPayment } from './confirm-payment';
import { rejectPayment } from './reject-payment';

function fakeRepo(seed: Receipt[]): ReceiptRepository {
  let rows = [...seed];
  return {
    list: async () => rows,
    listByResident: async (rid) => rows.filter((r) => r.residentId === rid),
    listByApartment: async (aid) => rows.filter((r) => r.apartmentId === aid),
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    save: async (r) => {
      rows = [...rows.filter((x) => x.id !== r.id), r];
      return r;
    },
  };
}

const analise: Receipt = {
  id: 'rc-1',
  ref: '07/2026',
  title: 'Taxa condominial',
  dueDate: '2026-07-15',
  valueCents: 15000,
  status: 'em_analise',
  method: 'pix',
  submittedAt: '2026-07-14',
  proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  residentId: 'r-1',
  apartmentId: 'apt-1',
};

describe('confirm/reject payment', () => {
  it('confirm sets pago with the given paidAt, keeping method', async () => {
    const repo = fakeRepo([analise]);
    const r = await confirmPayment(repo, 'rc-1', '2026-07-16');
    expect(r).toMatchObject({ status: 'pago', paidAt: '2026-07-16', method: 'pix' });
  });

  it('reject returns to pendente and clears proof/submittedAt/method/paidAt', async () => {
    const repo = fakeRepo([analise]);
    const r = await rejectPayment(repo, 'rc-1');
    expect(r.status).toBe('pendente');
    expect(r.proofDataUrl).toBeUndefined();
    expect(r.submittedAt).toBeUndefined();
    expect(r.method).toBeUndefined();
    expect(r.paidAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/api exec jest src/receipts/app/confirm-reject-payment.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`apps/api/src/receipts/app/confirm-payment.ts`:

```ts
import { ReceiptNotFoundError } from '../domain/errors';
import { isoDateSchema, receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function confirmPayment(
  repo: ReceiptRepository,
  id: string,
  paidAt: string,
): Promise<Receipt> {
  const when = isoDateSchema.parse(paidAt);
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const updated = receiptSchema.parse({ ...existing, status: 'pago', paidAt: when });
  return repo.save(updated);
}
```

`apps/api/src/receipts/app/reject-payment.ts`:

```ts
import { ReceiptNotFoundError } from '../domain/errors';
import { receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function rejectPayment(repo: ReceiptRepository, id: string): Promise<Receipt> {
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const { method, paidAt, submittedAt, proofDataUrl, ...rest } = existing;
  const updated = receiptSchema.parse({ ...rest, status: 'pendente' });
  return repo.save(updated);
}
```

In `apps/api/src/compose.ts`, register both before `api.route('/receipts', receiptRoutes(receipts))` (near the existing admin `PUT /receipts/:id`):

```ts
import { confirmPayment } from './receipts/app/confirm-payment';
import { rejectPayment } from './receipts/app/reject-payment';
```

```ts
api.post('/receipts/:id/confirm', requireRole('admin'), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { paidAt?: string };
  const paidAt = body.paidAt ?? new Date().toISOString().slice(0, 10);
  return c.json(await confirmPayment(receipts, c.req.param('id'), paidAt));
});
api.post('/receipts/:id/reject', requireRole('admin'), async (c) =>
  c.json(await rejectPayment(receipts, c.req.param('id'))),
);
```

- [ ] **Step 4: Run to verify pass**

Run: `make db-up && make api-test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipts/app/confirm-payment.ts apps/api/src/receipts/app/reject-payment.ts apps/api/src/receipts/app/confirm-reject-payment.test.ts apps/api/src/compose.ts
git commit -m "feat(api): admin confirms or rejects a submitted payment"
```

---

### Task 4: Resident submit + proof upload (web)

The resident's "Pagar taxa" now uploads a proof and submits for review; `em_analise` shows "Aguardando confirmação".

**Files:**

- Modify: `apps/web/src/features/receipts/domain/receipt.ts` (enum + fields, mirror API)
- Modify: `apps/web/src/features/receipts/ui/receipt-status-view.ts` (em_analise pill)
- Modify: `apps/web/src/features/receipts/domain/receipt-repository.ts` + `data/http-receipt-repository.ts` (add `submitPayment`)
- Modify: `apps/web/src/features/receipts/ui/use-receipts.ts` (`useSubmitPayment`)
- Modify: `apps/web/src/features/receipts/ui/pay-screen.tsx` (file input → base64 → submit)
- Modify: `apps/web/src/features/receipts/ui/receipts-screen.tsx` (em_analise state)
- Test: `apps/web/src/features/receipts/ui/pay-screen.test.tsx` (proof + submit), plus a small file-to-dataURL helper test

**Interfaces:**

- Consumes: `POST /api/receipts/:id/submit-payment` (Task 2).
- Produces: web `receiptStatusSchema` incl. `em_analise`; `Receipt.submittedAt?`/`proofDataUrl?`; `ReceiptRepository.submitPayment(id, { method, proofDataUrl }): Promise<Receipt>`; `fileToDataUrl(file): Promise<string>` helper.

- [ ] **Step 1: Write the failing test**

Add a helper `apps/web/src/features/receipts/domain/proof.ts` test `apps/web/src/features/receipts/domain/proof.test.ts`:

```ts
import { isAllowedProof } from './proof';

describe('isAllowedProof', () => {
  it('accepts image and pdf data urls, rejects others', () => {
    expect(isAllowedProof('data:image/png;base64,aaa')).toBe(true);
    expect(isAllowedProof('data:application/pdf;base64,aaa')).toBe(true);
    expect(isAllowedProof('data:text/plain;base64,aaa')).toBe(false);
    expect(isAllowedProof('nope')).toBe(false);
  });
});
```

And extend `pay-screen.test.tsx` with a submit-with-proof case (mirror the existing pay-screen test setup; upload a file via `fireEvent.change` on the file input, then confirm → the repo's `submitPayment` is called with the method + a data URL). Use a jsdom `File` + mock `FileReader` or assert the mutation is called.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/receipts`
Expected: FAIL — `proof.ts` missing / pay-screen has no file input.

- [ ] **Step 3: Implement**

- `receipt.ts`: `receiptStatusSchema = z.enum(['pendente', 'em_analise', 'pago'])`; add `submittedAt: z.string().optional()`, `proofDataUrl: z.string().optional()` to `receiptSchema`.
- `proof.ts`:

```ts
export function isAllowedProof(dataUrl: string): boolean {
  return /^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(dataUrl);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}
```

- `receipt-status-view.ts`: add `em_analise: { tone: 'pendente', label: 'Em análise' }` to `VIEW`.
- `receipt-repository.ts` + `http-receipt-repository.ts`: add `submitPayment(id, input: { method, proofDataUrl })` → `POST /api/receipts/${id}/submit-payment` with the body, parse the response with `receiptSchema`.
- `use-receipts.ts`: add `useSubmitPayment(repo)` mutation `({ id, method, proofDataUrl }) => repo.submitPayment(id, { method, proofDataUrl })`, invalidating `receiptsQueryKey` on success.
- `pay-screen.tsx`: replace the pay confirm with: a required file input (`accept="image/*,application/pdf"`), on change run `fileToDataUrl` + `isAllowedProof` (reject with an inline error otherwise); the confirm button calls `useSubmitPayment` with `{ id, method, proofDataUrl }`; on success `onDone()`. Keep the method toggle + Pix QR. Update copy: the button reads "Enviar comprovante" and success means "em análise".
- `receipts-screen.tsx`: for `status === 'em_analise'`, show a muted "Aguardando confirmação" chip instead of the pay button; keep "Pagar taxa" only for `pendente`.

- [ ] **Step 4: Run to verify pass**

Run: `make test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/receipts
git commit -m "feat(web): residents submit a payment proof for admin review"
```

---

### Task 5: Admin confirm/reject in the apartment ledger (web)

**Files:**

- Modify: `apps/web/src/app/container.ts` (`confirmPayment`, `rejectPayment`)
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (em_analise row: view proof + Confirmar/Rejeitar)
- Modify: `apps/web/src/app/app.tsx` (pass the two callbacks to `ResidentEditScreen`)
- Test: the resident-edit-screen test file (add an em_analise confirm/reject case)

**Interfaces:**

- Consumes: `POST /api/receipts/:id/confirm`, `POST /api/receipts/:id/reject` (Task 3).
- Produces: `container.confirmPayment({ receiptId, paidAt? }): Promise<void>`; `container.rejectPayment(receiptId): Promise<void>`; `ResidentEditScreen` gains `onConfirmPayment`/`onRejectPayment` props.

- [ ] **Step 1: Write the failing test**

In the resident-edit-screen test (find it), add a fixture receipt with `status: 'em_analise'` + `proofDataUrl`, render the ledger, and assert a "Confirmar" and "Rejeitar" control appear for it (and "Dar baixa" does not), and that clicking Confirmar calls `onConfirmPayment` with the receipt id. Mirror the existing register-payment test's structure.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/residents/ui`
Expected: FAIL — no confirm/reject controls.

- [ ] **Step 3: Implement**

- `container.ts`:

```ts
/** Admin-only: confirm a submitted payment (→ pago). */
export async function confirmPayment(input: { receiptId: string; paidAt?: string }): Promise<void> {
  await apiClient.post(
    `/api/receipts/${input.receiptId}/confirm`,
    input.paidAt ? { paidAt: input.paidAt } : {},
  );
}
/** Admin-only: reject a submitted payment (→ pendente). */
export async function rejectPayment(receiptId: string): Promise<void> {
  await apiClient.post(`/api/receipts/${receiptId}/reject`, {});
}
```

- `resident-edit-screen.tsx`: for a ledger receipt with `status === 'em_analise'`, render a "Ver comprovante" link (opens `receipt.proofDataUrl` in a new tab / an `<a href={proofDataUrl} download>` — reuse the existing download affordance style) plus **Confirmar** and **Rejeitar** buttons wired to new `onConfirmPayment(receiptId)` / `onRejectPayment(receiptId)` props; on success invalidate `['receipts']` + `residentsQueryKey` (mirror the register-payment mutation). Keep "Dar baixa" only for `pendente`.
- `app.tsx`: at the `a-resident-edit` case, pass `onConfirmPayment={(receiptId) => confirmPayment({ receiptId })}` and `onRejectPayment={rejectPayment}` (import both from the container), mirroring the existing `registerPayment`/`editReceipt` wiring.

- [ ] **Step 4: Run to verify pass**

Run: `make check`
Expected: PASS (web gate).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/container.ts apps/web/src/features/residents/ui/resident-edit-screen.tsx apps/web/src/app/app.tsx
git commit -m "feat(web): admin confirms or rejects submitted payments in the ledger"
```

---

### Task 6: Resident status override data layer (API)

Nullable `status_override` on residents; the effective status is `override ?? derived`.

**Files:**

- Modify: `apps/api/src/residents/domain/resident.ts` (`statusOverride` field)
- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `006_resident_status_override`)
- Modify: `apps/api/src/residents/adapters/postgres/resident-repository.ts` (SELECT + row + save + new `setStatusOverride`)
- Modify: `apps/api/src/residents/domain/resident-repository.ts` (interface: `setStatusOverride`)
- Modify: `apps/api/src/residents/app/list-residents.ts` + `apps/api/src/residents/app/get-resident.ts` (override precedence)
- Modify: `apps/api/src/residents/adapters/resident-repository.contract.ts` (round-trip + override)

**Interfaces:**

- Produces: `Resident` gains `statusOverride?: ResidentStatus | null`; `ResidentRepository.setStatusOverride(id, status: ResidentStatus | null): Promise<void>`; `listResidents`/`getResident` return `status = statusOverride ?? derived`.

- [ ] **Step 1: Write the failing tests**

Add to `list-residents.test.ts` (find it): with a resident whose receipts derive `atrasado` but `statusOverride: 'em_dia'`, `listResidents` returns `status: 'em_dia'`; with `statusOverride: null`, it returns the derived status. Add to the resident contract test a `setStatusOverride` round-trip (set → getById shows the override; set null → clears).

- [ ] **Step 2: Run to verify they fail**

Run: `make db-up && pnpm --filter @morada/api exec jest residents`
Expected: FAIL — `statusOverride` unknown / `setStatusOverride` missing.

- [ ] **Step 3: Implement**

- `resident.ts`: add `statusOverride: residentStatusSchema.nullable().optional()` to `residentSchema`.
- Migration `006_resident_status_override`: `ALTER TABLE residents ADD COLUMN status_override TEXT;`.
- `resident-repository.ts` interface: add `setStatusOverride(id: string, status: ResidentStatus | null): Promise<void>;`.
- pg adapter: add `r.status_override` to the `SELECT`; add `status_override: string | null` to `ResidentRow`; in the row→Resident mapping include `statusOverride: row.status_override ?? null`; the create/update `save` paths should preserve the existing override (SELECT it or leave the column untouched on UPDATE — UPDATE only name/phone/email/status, do NOT clobber `status_override`); implement `setStatusOverride` as `UPDATE residents SET status_override = $2 WHERE id = $1` (pass `null` to clear).
- `list-residents.ts`: `status: r.statusOverride ?? deriveResidentStatus(byResident.get(r.id) ?? [], now)`.
- `get-resident.ts`: `status: resident.statusOverride ?? deriveResidentStatus(mine, today())`.

- [ ] **Step 4: Run to verify pass**

Run: `make db-up && make api-test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/residents apps/api/src/platform/postgres/migrations.ts
git commit -m "feat(api): admin-overridable resident payment status"
```

---

### Task 7: Status override endpoint (API)

**Files:**

- Create: `apps/api/src/residents/app/override-status.ts`
- Create: `apps/api/src/residents/app/override-status.test.ts`
- Modify: `apps/api/src/residents/adapters/http/routes.ts` (add `PUT /:id/status`)

**Interfaces:**

- Consumes: `ResidentRepository.setStatusOverride` (Task 6); `residentStatusSchema`.
- Produces: `overrideStatus(repo, id, input): Promise<void>` where `input = { status: ResidentStatus | null }`; route `PUT /api/residents/:id/status` (admin — residentRoutes is already mounted under `guarded('admin', ...)`).

- [ ] **Step 1: Write the failing test**

`apps/api/src/residents/app/override-status.test.ts`:

```ts
import { overrideStatus } from './override-status';

function fakeRepo() {
  const calls: Array<{ id: string; status: unknown }> = [];
  return {
    setStatusOverride: async (id: string, status: unknown) => {
      calls.push({ id, status });
    },
    calls,
  };
}

describe('overrideStatus', () => {
  it('sets a valid manual status', async () => {
    const repo = fakeRepo();
    await overrideStatus(repo as never, 'r-1', { status: 'em_dia' });
    expect(repo.calls).toEqual([{ id: 'r-1', status: 'em_dia' }]);
  });

  it('clears the override when status is null', async () => {
    const repo = fakeRepo();
    await overrideStatus(repo as never, 'r-1', { status: null });
    expect(repo.calls).toEqual([{ id: 'r-1', status: null }]);
  });

  it('rejects an invalid status', async () => {
    const repo = fakeRepo();
    await expect(overrideStatus(repo as never, 'r-1', { status: 'bogus' })).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/api exec jest src/residents/app/override-status.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`apps/api/src/residents/app/override-status.ts`:

```ts
import { z } from 'zod';

import { ResidentValidationError } from '../domain/errors';
import { residentStatusSchema } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

const inputSchema = z.object({ status: residentStatusSchema.nullable() });

export async function overrideStatus(
  repo: ResidentRepository,
  id: string,
  input: unknown,
): Promise<void> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ResidentValidationError('Status inválido');
  await repo.setStatusOverride(id, parsed.data.status);
}
```

(Match the real resident validation error class in `residents/domain/errors.ts`.)

`apps/api/src/residents/adapters/http/routes.ts`: add

```ts
app.put('/:id/status', async (c) => {
  await overrideStatus(repo, c.req.param('id'), await c.req.json());
  return c.json({ ok: true });
});
```

(Import `overrideStatus`. The residentRoutes group is already admin-guarded in compose.)

- [ ] **Step 4: Run to verify pass**

Run: `make db-up && make api-test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/residents/app/override-status.ts apps/api/src/residents/app/override-status.test.ts apps/api/src/residents/adapters/http/routes.ts
git commit -m "feat(api): admin endpoint to override or clear resident status"
```

---

### Task 8: Admin status-override control (web)

**Files:**

- Modify: `apps/web/src/features/residents/domain/resident.ts` (`statusOverride` field)
- Modify: `apps/web/src/app/container.ts` (`overrideResidentStatus`)
- Modify: `apps/web/src/features/residents/data/http-resident-repository.ts` (`setStatusOverride`) + `domain/resident-repository.ts`
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (status control)
- Test: the resident-edit-screen test (override case)

**Interfaces:**

- Consumes: `PUT /api/residents/:id/status` (Task 7).
- Produces: web `Resident.statusOverride?`; `container.overrideResidentStatus({ residentId, status }): Promise<void>` (status `ResidentStatus | null`); a status control on the resident edit screen with "Automático" (clear) + the three manual statuses.

- [ ] **Step 1: Write the failing test**

In the resident-edit-screen test, render with a resident and assert a status control offers "Automático" + em dia/pendente/atrasado; selecting "Atrasado" calls `onOverrideStatus({ residentId, status: 'atrasado' })`; selecting "Automático" calls it with `status: null`. Mirror the existing screen test wiring.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @morada/web exec jest src/features/residents/ui`
Expected: FAIL — no status control / prop.

- [ ] **Step 3: Implement**

- web `resident.ts`: add `statusOverride: residentStatusSchema.nullable().optional()` to `residentSchema`.
- `resident-repository.ts` + `http-resident-repository.ts`: add `setStatusOverride(id, status: ResidentStatus | null): Promise<void>` → `PUT /api/residents/${id}/status` with `{ status }`.
- `container.ts`:

```ts
/** Admin-only: override a resident's payment status, or clear it (null → derived). */
export async function overrideResidentStatus(input: {
  residentId: string;
  status: 'em_dia' | 'pendente' | 'atrasado' | null;
}): Promise<void> {
  await residentRepository.setStatusOverride(input.residentId, input.status);
}
```

- `resident-edit-screen.tsx`: add a status control (a row of buttons: Automático · Em dia · Pendente · Atrasado) that calls a new `onOverrideStatus({ residentId, status })` prop (status `null` for Automático), then invalidates the residents query; the pill header shows the effective status and a small "manual" hint when `resident.statusOverride` is set. Wire `onOverrideStatus` through `app.tsx` to `container.overrideResidentStatus` (mirror existing prop wiring).

- [ ] **Step 4: Run to verify pass**

Run: `make check`
Expected: PASS (web gate).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/residents apps/web/src/app/container.ts apps/web/src/app/app.tsx
git commit -m "feat(web): admin control to override or clear a resident's status"
```

---

## Phase 3 done — final gate

- [ ] Run both full gates before the whole-branch review:

```bash
make check
make db-up && make api-check
```

Expected: both green, coverage ≥ 80%. This closes spec items 4 (admin status override) and 6 (resident submits payment + proof; admin confirms). The whole change set (Phases 1-3) is then complete on `feat/pagamentos-status-resumo`.

## Self-review notes

- **Spec coverage:** item 6 → Tasks 1-5 (em_analise + proof columns, resident submit, admin confirm/reject, web submit+upload, web confirm/reject); item 4 → Tasks 6-8 (override column + precedence, endpoint, web control).
- **Type consistency:** `receiptStatusSchema` = `['pendente','em_analise','pago']` identical api↔web; `submittedAt`/`proofDataUrl` optional on both `Receipt`s; `submitPayment`/`confirmPayment`/`rejectPayment` app signatures match the routes and the web repo/container methods; `Resident.statusOverride?` + `setStatusOverride(id, status|null)` consistent api↔web; `overrideStatus`/`overrideResidentStatus` agree on `{ status: ResidentStatus | null }`.
- **Migrations:** `005_receipt_review` (receipts) then `006_resident_status_override` (residents), append-only, in phase order.
- **Deviation from spec (documented, accepted):** the spec's item F named a `ProofStorage` port with an S3 swap; per the earlier decision proof is a base64 data URL in `receipts.proof_data_url` for now. The `proof.ts`/`fileToDataUrl` seam + the single `proofDataUrl` field keep a later object-storage swap localized.
- **No placeholders:** the "read X and mirror" steps (error classes, resident-edit ledger row, resident-edit test, http repo methods) each name a concrete existing analog.
- **Behavior change to flag in review:** residents can no longer `POST /:id/pay` (now 403); their path is submit-for-review. Any pre-existing test asserting resident self-pay must be adapted, not deleted.
