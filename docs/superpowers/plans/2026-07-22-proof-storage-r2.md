# Comprovantes em R2 (ProofStorage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move payment proofs from base64-in-Postgres to Cloudflare R2 behind a `ProofStorage` port, and stop shipping proofs inline in list responses — proofs become an authenticated `GET .../proof` endpoint gated on a `hasProof` flag. Per `docs/superpowers/specs/2026-07-22-proof-storage-r2-design.md`.

**Architecture:** Write stays base64 (client unchanged); the Postgres adapter offloads to R2 when configured (else keeps base64 in the DB — dev/test/CI fallback). Reads split: lists carry `hasProof` only; a dedicated endpoint streams bytes (from R2 or, for legacy rows, the base64 column). Tasks 1–5 need NO R2 credentials (fully tested via the DB fallback + a fake `ProofStorage`). Task 6 (Fly secrets + deploy) is gated on the user's R2 API token.

**Tech Stack:** Hono + pg, `@aws-sdk/client-s3` (S3-compatible → R2), Zod, React/TanStack Query, Jest.

## Global Constraints

- **Spec trailer (enforced):** commits touching `apps/api/src/<feature>/**` or `apps/web/src/features/<feature>/**` MUST carry `Spec: docs/superpowers/specs/2026-07-22-proof-storage-r2-design.md`. `platform/**`/`compose.ts`/top-level are exempt (trailer still safe).
- **TDD:** failing test first, same commit. Coverage ≥ 80%. No `any`, no non-null assertions, no `console.*`. Immutability. Zod at boundaries. Explicit errors.
- `proof_key`/`has_proof` are persistence-only — NOT in the domain Zod schemas (like `visible`). `proofDataUrl` stays a WRITE-only optional input; reads never repopulate it.
- Conventional commits; never `--no-verify`; prettier-format everything (CI checks all). Run `make api-check` (API) / `make check` (web) / `make e2e` (once, end) green.
- Bucket already exists: `morada-proofs`. R2 env names: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

---

## Task 1: `ProofStorage` port + R2 adapter + config

**Files:**

- Modify: `apps/api/package.json` (add `@aws-sdk/client-s3`)
- Modify: `apps/api/src/platform/config.ts` (add `r2` block)
- Create: `apps/api/src/receipts/domain/proof-storage.ts` (the port interface + a pure `decodeDataUrl` helper)
- Create: `apps/api/src/receipts/domain/proof-storage.test.ts`
- Create: `apps/api/src/receipts/adapters/r2/r2-proof-storage.ts` (S3 client adapter)
- Create: `apps/api/src/platform/config.test.ts` addition OR a new test for the r2 parse (mirror how `parseWebOrigins` is tested)

**Interfaces (Produces):**

```ts
export type ProofBytes = { contentType: string; body: Uint8Array };
export interface ProofStorage {
  put(key: string, dataUrl: string): Promise<void>;
  get(key: string): Promise<ProofBytes | null>;
}
export function decodeDataUrl(dataUrl: string): ProofBytes; // parses `data:<ct>;base64,<b64>`
export type R2Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};
export function parseR2Config(env: NodeJS.ProcessEnv): R2Config | null; // all 4 set → obj, else null
```

- [ ] **Step 1: Install** `pnpm --filter @morada/api add @aws-sdk/client-s3` (confirm it resolves; it is pure JS, no native deps — fits the esbuild bundle).
- [ ] **Step 2: Failing test** for `decodeDataUrl` + `parseR2Config`:

```ts
import { decodeDataUrl } from './proof-storage';
test('decodeDataUrl splits content-type and bytes', () => {
  const { contentType, body } = decodeDataUrl(
    'data:image/png;base64,' + Buffer.from('hi').toString('base64'),
  );
  expect(contentType).toBe('image/png');
  expect(Buffer.from(body).toString()).toBe('hi');
});
test('decodeDataUrl rejects a non-data-url', () => {
  expect(() => decodeDataUrl('nope')).toThrow();
});
```

And for parseR2Config: all 4 env vars set → object; missing any → null.

- [ ] **Step 3: Implement** `proof-storage.ts` (port + `decodeDataUrl` via a regex `^data:([^;]+);base64,(.+)$`, `Buffer.from(b64, 'base64')`), and `parseR2Config` in `config.ts` with `config.r2 = parseR2Config(process.env)`.
- [ ] **Step 4: Implement** `R2ProofStorage` (`apps/api/src/receipts/adapters/r2/r2-proof-storage.ts`):

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import type { ProofStorage, ProofBytes, R2Config } from '../../domain/proof-storage';
import { decodeDataUrl } from '../../domain/proof-storage';

export class R2ProofStorage implements ProofStorage {
  private readonly client: S3Client;
  constructor(private readonly cfg: R2Config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  async put(key: string, dataUrl: string): Promise<void> {
    const { contentType, body } = decodeDataUrl(dataUrl);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
  async get(key: string): Promise<ProofBytes | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      );
      const body = new Uint8Array(await res.Body!.transformToByteArray()); // NOTE: replace `!` — see step 5
      return { contentType: res.ContentType ?? 'application/octet-stream', body };
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }
}
```

- [ ] **Step 5: Remove the non-null assertion** — `res.Body` is possibly undefined and `!` is banned. Guard it: `if (!res.Body) return null;` then `await res.Body.transformToByteArray()`.
- [ ] **Step 6:** No live-R2 test (no creds). `make api-check` green. Commit: `feat(receipts): add the ProofStorage port and its R2 adapter` + trailer.

---

## Task 2: Migration 013 + receipt pg adapter offload/serve + hasProof

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `013_proof_key`)
- Modify: `apps/api/src/receipts/domain/receipt.ts` (add `hasProof?: boolean`)
- Modify: `apps/api/src/receipts/adapters/postgres/receipt-repository.ts` (constructor takes `storage: ProofStorage | null`; offload on save; lean SELECTs + `has_proof`; add `getProof`)
- Modify: `apps/api/src/receipts/domain/receipt-repository.ts` (interface gains `getProof(id): Promise<ProofBytes | null>`)
- Tests: `apps/api/src/receipts/adapters/postgres/receipt-repository.test.ts`, `receipt-repository.contract.ts`

- [ ] **Step 1:** Migration entry (match existing `{ id, sql }` shape):

```ts
{ id: '013_proof_key', sql: 'ALTER TABLE receipts ADD COLUMN proof_key TEXT; ALTER TABLE incomes ADD COLUMN proof_key TEXT;' }
```

(Both tables here so income Task 3 needs no new migration.)

- [ ] **Step 2: Failing pg tests** (inject a fake `ProofStorage` — a Map-backed put/get):
  - `save` with a base64 `proofDataUrl` + storage set → `storage.put('receipts/<id>', dataUrl)` called, row has `proof_key` set and `proof_data_url` NULL; the returned Receipt has `hasProof: true` and no `proofDataUrl`.
  - `save` with storage `null` (fallback) → `proof_data_url` keeps the base64, `proof_key` NULL, `hasProof: true`.
  - `getProof(id)`: proof_key → returns `storage.get` bytes; legacy row (proof_data_url only) → returns decoded bytes; no proof → null.
  - `list`/`listByApartment` → items carry `hasProof` boolean and NEVER `proofDataUrl`.

- [ ] **Step 3: Implement.** Split the SELECT: drop `proof_data_url` from the list/get column set; add `(proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof`. `rowToReceipt` sets `hasProof: row.has_proof` and no longer sets `proofDataUrl`. `save`: if `receipt.proofDataUrl` is present AND is a fresh data URL AND `this.storage` → `await this.storage.put(key, receipt.proofDataUrl)`, persist `proof_key = key`, `proof_data_url = NULL`; else persist `proof_data_url = receipt.proofDataUrl ?? null`, `proof_key = NULL`. Reject-payment clears both (proof removed → set both NULL; if a key existed, deleting the R2 object is out of scope — leave orphan, cheap). `getProof`: read `proof_key`, `proof_data_url` for the id; key → `storage.get(key)`; else base64 → `decodeDataUrl`; else null. Constructor: `constructor(private pool: Pool, private storage: ProofStorage | null)`.

- [ ] **Step 4:** `make api-check` green (update the contract test + every constructor call site — `grep -rn "new PostgresReceiptRepository\|PostgresReceiptRepository(" apps/api/src` — pass a fake/null storage in tests, real in composition later). Commit: `feat(receipts): offload proofs to storage and expose them via getProof` + trailer.

---

## Task 3: Income pg adapter parity

**Files:**

- Modify: `apps/api/src/income/domain/income.ts` (add `hasProof?: boolean`)
- Modify: `apps/api/src/income/domain/income-repository.ts` (add `getProof(id)`)
- Modify: `apps/api/src/income/adapters/postgres/income-repository.ts` (constructor `storage: ProofStorage | null`; same offload/lean-list/getProof as receipts, key `incomes/<id>`)
- Tests: income pg adapter test + contract

- [ ] **Step 1–3:** Mirror Task 2 exactly for income (reuse the `ProofStorage` port + `decodeDataUrl` from receipts/domain — income already imports `proofSchema` from receipts/domain, so a cross-import of the port type is consistent with the existing boundary). Failing tests → implement → `make api-check` green.
- [ ] **Step 4:** Commit: `feat(income): offload proofs to storage and expose them via getProof` + trailer.

---

## Task 4: Proof-serving routes + composition wiring

**Files:**

- Modify: `apps/api/src/receipts/adapters/http/routes.ts` (add `GET /:id/proof`)
- Modify: `apps/api/src/income/adapters/http/routes.ts` (add `GET /:id/proof`)
- Modify: `apps/api/src/repositories.ts` + `apps/api/src/compose.ts` (build `ProofStorage` from `config.r2`, inject into both pg repos)
- Tests: `compose.test.ts` (proof endpoints: owner/admin 200 + content-type; foreign resident 403; missing 404; income admin-only)

- [ ] **Step 1: Failing route tests** in `compose.test.ts`: seed a receipt with a proof (base64 fallback, since tests have no R2), then `GET /api/receipts/:id/proof` as admin → 200 with the right `Content-Type`; as the owning resident → 200; as a foreign resident → 403; a receipt without proof → 404. Income: `GET /api/incomes/:id/proof` admin → 200; resident → 403 (admin-only mount).
- [ ] **Step 2: Implement the receipt route** (reuse `denyForeignReceipt`):

```ts
app.get('/:id/proof', async (c) => {
  const receipt = await repo.getById(c.req.param('id'));
  if (!receipt) return c.json({ error: 'Recibo não encontrado' }, 404);
  const forbidden = denyForeignReceipt(c, receipt);
  if (forbidden) return forbidden;
  const proof = await repo.getProof(receipt.id);
  if (!proof) return c.json({ error: 'Comprovante não encontrado' }, 404);
  return c.body(proof.body, 200, { 'Content-Type': proof.contentType });
});
```

Income route: admin-only (its mount is `guarded('admin', ...)`), `getProof` → same body/404.

- [ ] **Step 3: Wire composition** — in `repositories.ts` (or `compose.ts`, wherever the pg repos are constructed): `const proofStorage = config.r2 ? new R2ProofStorage(config.r2) : null;` and pass into `PostgresReceiptRepository`/`PostgresIncomeRepository`. Keep dev/test (`config.r2 === null`) on the DB fallback.
- [ ] **Step 4:** `make api-check` green. Commit: `feat(receipts,income): serve proofs from an authenticated endpoint` + trailer.

---

## Task 5: Web — hasProof-gated proof links

**Files:**

- Modify: `apps/web/src/features/receipts/domain/receipt.ts` (schema: add `hasProof: z.boolean().optional()`; keep `proofDataUrl` optional for write)
- Modify: `apps/web/src/features/residents/ui/resident-edit-screen.tsx` (the "Ver comprovante" link → gate on `hasProof`, `href={\`${apiUrl}/api/receipts/${receipt.id}/proof\`}`— but the app is same-origin via proxy in prod and vite-proxy in dev, so a RELATIVE`href={\`/api/receipts/${id}/proof\`}`works in both; confirm the app has no`<base>`; use the relative form)
- Modify: `apps/web/src/features/income/domain/income.ts` (+ `hasProof`) and `apps/web/src/features/income/ui/income-edit-screen.tsx` (proof link → `/api/incomes/:id/proof`, gated)
- Tests: the screen tests asserting the proof link/button

- [ ] **Step 1: Failing web tests** — a receipt with `hasProof: true` renders a "Ver comprovante" link pointing at `/api/receipts/<id>/proof`; with `hasProof` falsy, no link. Same for income.
- [ ] **Step 2: Implement.** Replace `receipt.proofDataUrl &&`/`href={receipt.proofDataUrl}` with `receipt.hasProof &&`/`href={\`/api/receipts/${receipt.id}/proof\`}`. Keep `download`/label. Income likewise. Remove now-unused `proofDataUrl` reads from response types (the write inputs stay).
- [ ] **Step 3:** `make check` green. `make e2e` once — the journey submits a proof and the admin confirms; if the journey asserted on an inline proof it must move to the `hasProof`/endpoint form (read the journey; likely it only checks the "Ver comprovante" affordance — update the locator if needed). Commit(s): `feat(web): link proofs to the serving endpoint gated on hasProof` + trailer.

---

## Task 6 (GATED — needs the user's R2 API token): deploy

**Files:**

- Modify: `docs/DEPLOY.md` (R2 secrets section)

- [ ] **Step 1:** With the user's credentials: `flyctl secrets set -a morada-api R2_ENDPOINT=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=morada-proofs` (triggers a Fly redeploy; migration 013 runs in release_command).
- [ ] **Step 2:** Doc the secrets in `docs/DEPLOY.md`. Commit: `docs: document the R2 proof-storage secrets`.
- [ ] **Step 3: Prod smoke** — log in as a resident on prod, submit a payment with a proof; confirm the object lands in `morada-proofs` (`pnpm dlx wrangler@4 r2 object get morada-proofs/receipts/<id>` or dashboard) and the admin "Ver comprovante" opens it. Legacy base64 receipts still open (fallback).

---

## Self-Review

- Spec coverage: config/port/adapter → T1; migration+receipts → T2; income → T3; routes+wiring → T4; web → T5; deploy → T6. Complete.
- Types: `ProofStorage`/`ProofBytes`/`decodeDataUrl`/`R2Config`/`parseR2Config` defined in T1, consumed T2–T4; `hasProof` added T2/T3 (domain) and T5 (web); `getProof` on both repo interfaces.
- The only credential-dependent work is T6; T1–T5 are provable via the DB fallback + fake storage and land/merge without the token.
- No placeholders: the one non-null assertion in the T1 snippet is explicitly removed in T1 Step 5.
