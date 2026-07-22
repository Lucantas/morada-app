import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { insertRows, resetPg } from '../../../test-support/pg';
import { MonthlyReceiptExistsError } from '../../domain/errors';
import type { ProofBytes, ProofStorage } from '../../domain/proof-storage';
import { runReceiptRepositoryContract } from '../receipt-repository.contract';

import { PostgresReceiptRepository } from './receipt-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

class FakeProofStorage implements ProofStorage {
  private readonly store = new Map<string, string>();

  async put(key: string, dataUrl: string): Promise<void> {
    this.store.set(key, dataUrl);
  }

  async get(key: string): Promise<ProofBytes | null> {
    const dataUrl = this.store.get(key);
    if (!dataUrl) return null;
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    const contentType = match?.[1];
    const base64 = match?.[2];
    if (!contentType || !base64) return null;
    return { contentType, body: new Uint8Array(Buffer.from(base64, 'base64')) };
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runReceiptRepositoryContract('PostgresReceiptRepository', async () => {
  await resetPg(pool);
  return new PostgresReceiptRepository(pool, null);
});

describe('PostgresReceiptRepository — monthly condo-fee uniqueness', () => {
  const RECEIPT_COLUMNS = [
    'id',
    'ref',
    'title',
    'due_date',
    'value_cents',
    'status',
    'resident_id',
  ];

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('migration archives duplicate visible condo-fee receipts, keeping the pago one', async () => {
    // The unique index (already applied in beforeAll) forbids seeding two
    // visible duplicates directly, so this drops the index, seeds the
    // pre-migration duplicate state, then reruns the exact dedupe step the
    // migration performs before recreating the index — proving the ranking
    // rule (pago > em_analise > rest, tie-break lowest id) end to end.
    await pool.query('DROP INDEX idx_receipts_condo_fee_month');
    await insertRows(pool, 'receipts', RECEIPT_COLUMNS, [
      {
        id: 'dup-pendente',
        ref: '07/2026',
        title: 'Taxa condominial',
        due_date: '2026-07-15',
        value_cents: 15000,
        status: 'pendente',
        resident_id: 'r-1',
      },
      {
        id: 'dup-pago',
        ref: '07/2026',
        title: 'Taxa condominial',
        due_date: '2026-07-15',
        value_cents: 15000,
        status: 'pago',
        resident_id: 'r-1',
      },
    ]);

    await pool.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY resident_id, ref
                 ORDER BY
                   CASE status WHEN 'pago' THEN 0 WHEN 'em_analise' THEN 1 ELSE 2 END,
                   id
               ) AS rn
        FROM receipts
        WHERE visible AND title = 'Taxa condominial'
      )
      UPDATE receipts SET visible = false
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);
    await pool.query(`
      CREATE UNIQUE INDEX idx_receipts_condo_fee_month
        ON receipts (resident_id, ref) WHERE visible AND title = 'Taxa condominial'
    `);

    const repo = new PostgresReceiptRepository(pool, null);
    expect(await repo.getById('dup-pago')).not.toBeNull();
    expect(await repo.getById('dup-pendente')).toBeNull();
  });

  test('the partial unique index blocks a second visible condo-fee receipt for the same resident/month', async () => {
    await insertRows(pool, 'receipts', RECEIPT_COLUMNS, [
      {
        id: 'first',
        ref: '07/2026',
        title: 'Taxa condominial',
        due_date: '2026-07-15',
        value_cents: 15000,
        status: 'pendente',
        resident_id: 'r-1',
      },
    ]);

    await expect(
      pool.query(
        `INSERT INTO receipts (${RECEIPT_COLUMNS.join(', ')}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['second', '07/2026', 'Taxa condominial', '2026-07-15', 15000, 'pendente', 'r-1'],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'idx_receipts_condo_fee_month' });
  });

  test('save throws MonthlyReceiptExistsError when it collides with the unique index', async () => {
    const repo = new PostgresReceiptRepository(pool, null);
    await repo.save({
      id: 'first',
      ref: '07/2026',
      title: 'Taxa condominial',
      dueDate: '2026-07-15',
      valueCents: 15000,
      status: 'pendente',
      residentId: 'r-1',
    });

    await expect(
      repo.save({
        id: 'second',
        ref: '07/2026',
        title: 'Taxa condominial',
        dueDate: '2026-07-15',
        valueCents: 15000,
        status: 'pendente',
        residentId: 'r-1',
      }),
    ).rejects.toThrow(MonthlyReceiptExistsError);
  });
});

describe('PostgresReceiptRepository — proof offload/serve', () => {
  const BASE_RECEIPT = {
    id: 'rc-1',
    ref: '07/2026',
    title: 'Taxa condominial',
    dueDate: '2026-07-15',
    valueCents: 15000,
    status: 'em_analise' as const,
    method: 'pix' as const,
    submittedAt: '2026-07-14',
    residentId: 'r-1',
    apartmentId: 'apt-1',
  };
  const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('save offloads a fresh data URL to storage, persisting proof_key (not the base64) and hasProof: true', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresReceiptRepository(pool, storage);

    const saved = await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    expect(saved.hasProof).toBe(true);
    expect(saved.proofDataUrl).toBeUndefined();
    expect(storage.has('receipts/rc-1')).toBe(true);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM receipts WHERE id = $1',
      ['rc-1'],
    );
    expect(rows[0].proof_key).toBe('receipts/rc-1');
    expect(rows[0].proof_data_url).toBeNull();

    const fetched = await repo.getById('rc-1');
    expect(fetched?.hasProof).toBe(true);
    expect(fetched?.proofDataUrl).toBeUndefined();
  });

  test('save falls back to storing the base64 inline when storage is null, still reporting hasProof: true', async () => {
    const repo = new PostgresReceiptRepository(pool, null);

    await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM receipts WHERE id = $1',
      ['rc-1'],
    );
    expect(rows[0].proof_key).toBeNull();
    expect(rows[0].proof_data_url).toBe(DATA_URL);

    const fetched = await repo.getById('rc-1');
    expect(fetched?.hasProof).toBe(true);
    expect(fetched?.proofDataUrl).toBeUndefined();
  });

  test('getProof returns bytes from storage when proof_key is set', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresReceiptRepository(pool, storage);
    await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    const proof = await repo.getProof('rc-1');

    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof decodes legacy base64 when only proof_data_url is set', async () => {
    const repo = new PostgresReceiptRepository(pool, null);
    await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    const proof = await repo.getProof('rc-1');

    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof returns null when the receipt has no proof', async () => {
    const repo = new PostgresReceiptRepository(pool, null);
    await repo.save({ ...BASE_RECEIPT, status: 'pendente', proofDataUrl: undefined });

    expect(await repo.getProof('rc-1')).toBeNull();
  });

  test('getProof returns null for an unknown id', async () => {
    const repo = new PostgresReceiptRepository(pool, null);
    expect(await repo.getProof('nope')).toBeNull();
  });

  test('list/listByApartment/listByResident carry hasProof, never proofDataUrl', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresReceiptRepository(pool, storage);
    await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    for (const items of [
      await repo.list(),
      await repo.listByApartment('apt-1'),
      await repo.listByResident('r-1'),
    ]) {
      expect(items).toHaveLength(1);
      const [item] = items;
      expect(item?.hasProof).toBe(true);
      expect(item).not.toHaveProperty('proofDataUrl');
    }
  });
});

describe('PostgresReceiptRepository — proof preservation on proof-less re-save (regression)', () => {
  const BASE_RECEIPT = {
    id: 'rc-1',
    ref: '07/2026',
    title: 'Taxa condominial',
    dueDate: '2026-07-15',
    valueCents: 15000,
    status: 'em_analise' as const,
    method: 'pix' as const,
    submittedAt: '2026-07-14',
    residentId: 'r-1',
    apartmentId: 'apt-1',
  };
  const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('confirm-payment style re-save (proofDataUrl: undefined, base64 fallback mode) preserves the existing proof', async () => {
    const repo = new PostgresReceiptRepository(pool, null);
    await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    const resaved = await repo.save({
      ...BASE_RECEIPT,
      status: 'pago',
      paidAt: '2026-07-20',
      proofDataUrl: undefined,
    });

    expect(resaved.hasProof).toBe(true);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM receipts WHERE id = $1',
      ['rc-1'],
    );
    expect(rows[0].proof_data_url).toBe(DATA_URL);
    expect(rows[0].proof_key).toBeNull();

    const proof = await repo.getProof('rc-1');
    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('confirm-payment style re-save (proofDataUrl: undefined, storage mode) preserves the existing proof_key', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresReceiptRepository(pool, storage);
    await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    const resaved = await repo.save({
      ...BASE_RECEIPT,
      status: 'pago',
      paidAt: '2026-07-20',
      proofDataUrl: undefined,
    });

    expect(resaved.hasProof).toBe(true);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM receipts WHERE id = $1',
      ['rc-1'],
    );
    expect(rows[0].proof_key).toBe('receipts/rc-1');
    expect(rows[0].proof_data_url).toBeNull();

    const proof = await repo.getProof('rc-1');
    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('reject-payment style re-save (proofDataUrl: null) explicitly clears the proof', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresReceiptRepository(pool, storage);
    await repo.save({ ...BASE_RECEIPT, proofDataUrl: DATA_URL });

    const resaved = await repo.save({
      ...BASE_RECEIPT,
      status: 'pendente',
      method: undefined,
      submittedAt: undefined,
      proofDataUrl: null,
    });

    expect(resaved.hasProof).toBe(false);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM receipts WHERE id = $1',
      ['rc-1'],
    );
    expect(rows[0].proof_key).toBeNull();
    expect(rows[0].proof_data_url).toBeNull();

    expect(await repo.getProof('rc-1')).toBeNull();
  });

  test('brand-new insert with proofDataUrl: undefined succeeds with hasProof: false', async () => {
    const repo = new PostgresReceiptRepository(pool, null);

    const saved = await repo.save({
      id: 'rc-new',
      ref: '07/2026',
      title: 'Taxa condominial',
      dueDate: '2026-07-15',
      valueCents: 15000,
      status: 'pendente',
      residentId: 'r-2',
      proofDataUrl: undefined,
    });

    expect(saved.hasProof).toBe(false);
    expect(await repo.getProof('rc-new')).toBeNull();
  });
});
