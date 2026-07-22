import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runIncomeRepositoryContract } from '../income-repository.contract';

import { PostgresIncomeRepository } from './income-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runIncomeRepositoryContract('PostgresIncomeRepository', async () => {
  await resetPg(pool);
  return new PostgresIncomeRepository(pool);
});

describe('PostgresIncomeRepository archive', () => {
  test('archive hides the income from list and getById but keeps the row', async () => {
    await resetPg(pool);
    const repo = new PostgresIncomeRepository(pool);
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
