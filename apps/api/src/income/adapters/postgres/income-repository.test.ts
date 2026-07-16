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
