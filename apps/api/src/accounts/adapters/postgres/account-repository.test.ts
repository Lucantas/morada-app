import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import type { ProofBytes, ProofStorage } from '../../../receipts/domain/proof-storage';
import { resetPg } from '../../../test-support/pg';
import { runAccountRepositoryContract } from '../account-repository.contract';

import { PostgresAccountRepository } from './account-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runAccountRepositoryContract('PostgresAccountRepository', async () => {
  await resetPg(pool);
  return new PostgresAccountRepository(pool, null);
});

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

describe('PostgresAccountRepository — proof offload/serve', () => {
  const BASE = {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
    valueCents: 5000,
    status: 'pago' as const,
  };
  const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('offloads a fresh data URL to storage, persisting proof_key (not base64) and hasProof', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);

    const saved = await repo.save({ ...BASE, proofDataUrl: DATA_URL });

    expect(saved.hasProof).toBe(true);
    expect(saved.proofDataUrl).toBeUndefined();
    expect(storage.has('accounts/a-1')).toBe(true);
    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM accounts WHERE id = $1',
      ['a-1'],
    );
    expect(rows[0].proof_key).toBe('accounts/a-1');
    expect(rows[0].proof_data_url).toBeNull();
  });

  test('falls back to inline base64 when storage is null, still hasProof: true', async () => {
    const repo = new PostgresAccountRepository(pool, null);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const { rows } = await pool.query(
      'SELECT proof_key, proof_data_url FROM accounts WHERE id = $1',
      ['a-1'],
    );
    expect(rows[0].proof_key).toBeNull();
    expect(rows[0].proof_data_url).toBe(DATA_URL);
    expect((await repo.getById('a-1'))?.hasProof).toBe(true);
  });

  test('getProof returns bytes from storage when proof_key is set', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const proof = await repo.getProof('a-1');
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof decodes legacy base64 when only proof_data_url is set', async () => {
    const repo = new PostgresAccountRepository(pool, null);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const proof = await repo.getProof('a-1');
    expect(proof?.contentType).toBe('image/png');
  });

  test('getProof returns null with no proof and for an unknown id', async () => {
    const repo = new PostgresAccountRepository(pool, null);
    await repo.save({ ...BASE, proofDataUrl: undefined });
    expect(await repo.getProof('a-1')).toBeNull();
    expect(await repo.getProof('nope')).toBeNull();
  });

  test('list carries hasProof, never proofDataUrl', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });
    const [item] = await repo.list();
    expect(item?.hasProof).toBe(true);
    expect(item).not.toHaveProperty('proofDataUrl');
  });

  test('re-save with proofDataUrl undefined preserves; null clears', async () => {
    const storage = new FakeProofStorage();
    const repo = new PostgresAccountRepository(pool, storage);
    await repo.save({ ...BASE, proofDataUrl: DATA_URL });

    const kept = await repo.save({
      ...BASE,
      description: 'Água — abril (rev)',
      proofDataUrl: undefined,
    });
    expect(kept.hasProof).toBe(true);

    const cleared = await repo.save({ ...BASE, proofDataUrl: null });
    expect(cleared.hasProof).toBe(false);
    expect(await repo.getProof('a-1')).toBeNull();
  });
});
