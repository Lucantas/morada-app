import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import type { ProofBytes, ProofStorage } from '../../../receipts/domain/proof-storage';
import { resetPg } from '../../../test-support/pg';
import { runIncomeRepositoryContract } from '../income-repository.contract';

import { PostgresIncomeRepository } from './income-repository';

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

runIncomeRepositoryContract('PostgresIncomeRepository', async () => {
  await resetPg(pool);
  return new PostgresIncomeRepository(pool, null);
});

describe('PostgresIncomeRepository archive', () => {
  test('archive hides the income from list and getById but keeps the row', async () => {
    await resetPg(pool);
    const repo = new PostgresIncomeRepository(pool, null);
    const saved = await repo.save({
      id: 'i-1',
      description: 'Aluguel salão de festas',
      source: 'Apto 302',
      date: '2026-04-05',
      valueCents: 15000,
      proofDataUrl: undefined,
    });

    await repo.archive(saved.id);

    expect(await repo.list()).toEqual([]);
    expect(await repo.getById(saved.id)).toBeNull();
    const { rows } = await pool.query('SELECT visible FROM incomes WHERE id = $1', [saved.id]);
    expect(rows[0].visible).toBe(false);
  });
});

describe('PostgresIncomeRepository — proof offload/serve', () => {
  const BASE_INCOME = {
    id: 'i-1',
    description: 'Aluguel salão de festas',
    source: 'Apto 302',
    date: '2026-04-05',
    valueCents: 15000,
  };
  const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('save offloads a fresh data URL to storage, persisting proof_key (not the base64) and hasProof: true', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresIncomeRepository(pool, storage);

    const saved = await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    expect(saved.hasProof).toBe(true);
    expect(saved.proofDataUrl).toBeUndefined();
    expect(storage.has('incomes/i-1')).toBe(true);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM incomes WHERE id = $1',
      ['i-1'],
    );
    expect(rows[0].proof_key).toBe('incomes/i-1');
    expect(rows[0].proof_data_url).toBeNull();

    const fetched = await repo.getById('i-1');
    expect(fetched?.hasProof).toBe(true);
    expect(fetched?.proofDataUrl).toBeUndefined();
  });

  test('save falls back to storing the base64 inline when storage is null, still reporting hasProof: true', async () => {
    const repo = new PostgresIncomeRepository(pool, null);

    await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM incomes WHERE id = $1',
      ['i-1'],
    );
    expect(rows[0].proof_key).toBeNull();
    expect(rows[0].proof_data_url).toBe(DATA_URL);

    const fetched = await repo.getById('i-1');
    expect(fetched?.hasProof).toBe(true);
    expect(fetched?.proofDataUrl).toBeUndefined();
  });

  test('getProof returns bytes from storage when proof_key is set', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresIncomeRepository(pool, storage);
    await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    const proof = await repo.getProof('i-1');

    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof decodes legacy base64 when only proof_data_url is set', async () => {
    const repo = new PostgresIncomeRepository(pool, null);
    await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    const proof = await repo.getProof('i-1');

    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof returns null when the income has no proof', async () => {
    const repo = new PostgresIncomeRepository(pool, null);
    await repo.save({ ...BASE_INCOME, proofDataUrl: undefined });

    expect(await repo.getProof('i-1')).toBeNull();
  });

  test('getProof returns null for an unknown id', async () => {
    const repo = new PostgresIncomeRepository(pool, null);
    expect(await repo.getProof('nope')).toBeNull();
  });

  test('list carries hasProof, never proofDataUrl', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresIncomeRepository(pool, storage);
    await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    const items = await repo.list();

    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item?.hasProof).toBe(true);
    expect(item).not.toHaveProperty('proofDataUrl');
  });
});

describe('PostgresIncomeRepository — proof preservation on proof-less re-save (regression)', () => {
  const BASE_INCOME = {
    id: 'i-1',
    description: 'Aluguel salão de festas',
    source: 'Apto 302',
    date: '2026-04-05',
    valueCents: 15000,
  };
  const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('updateIncome-style re-save (proofDataUrl: undefined, base64 fallback mode) preserves the existing proof', async () => {
    const repo = new PostgresIncomeRepository(pool, null);
    await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    const resaved = await repo.save({
      ...BASE_INCOME,
      description: 'Aluguel salão de festas (atualizado)',
      proofDataUrl: undefined,
    });

    expect(resaved.hasProof).toBe(true);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM incomes WHERE id = $1',
      ['i-1'],
    );
    expect(rows[0].proof_data_url).toBe(DATA_URL);
    expect(rows[0].proof_key).toBeNull();

    const proof = await repo.getProof('i-1');
    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('updateIncome-style re-save (proofDataUrl: undefined, storage mode) preserves the existing proof_key', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresIncomeRepository(pool, storage);
    await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    const resaved = await repo.save({
      ...BASE_INCOME,
      description: 'Aluguel salão de festas (atualizado)',
      proofDataUrl: undefined,
    });

    expect(resaved.hasProof).toBe(true);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM incomes WHERE id = $1',
      ['i-1'],
    );
    expect(rows[0].proof_key).toBe('incomes/i-1');
    expect(rows[0].proof_data_url).toBeNull();

    const proof = await repo.getProof('i-1');
    expect(proof).not.toBeNull();
    expect(proof?.contentType).toBe('image/png');
  });

  test('save with proofDataUrl: null explicitly clears the proof', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresIncomeRepository(pool, storage);
    await repo.save({ ...BASE_INCOME, proofDataUrl: DATA_URL });

    const resaved = await repo.save({
      ...BASE_INCOME,
      proofDataUrl: null,
    });

    expect(resaved.hasProof).toBe(false);

    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM incomes WHERE id = $1',
      ['i-1'],
    );
    expect(rows[0].proof_key).toBeNull();
    expect(rows[0].proof_data_url).toBeNull();

    expect(await repo.getProof('i-1')).toBeNull();
  });

  test('brand-new insert with proofDataUrl: undefined succeeds with hasProof: false', async () => {
    const repo = new PostgresIncomeRepository(pool, null);

    const saved = await repo.save({
      id: 'i-new',
      description: 'Aluguel salão de festas',
      source: 'Apto 302',
      date: '2026-04-05',
      valueCents: 15000,
      proofDataUrl: undefined,
    });

    expect(saved.hasProof).toBe(false);
    expect(await repo.getProof('i-new')).toBeNull();
  });
});
