import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runCondoRepositoryContract } from '../condo-repository.contract';

import { PostgresCondoRepository } from './condo-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runCondoRepositoryContract('PostgresCondoRepository', async () => {
  await resetPg(pool);
  return { repo: new PostgresCondoRepository(pool), pool };
});
