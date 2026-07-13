import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runReceiptRepositoryContract } from '../receipt-repository.contract';

import { PostgresReceiptRepository } from './receipt-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runReceiptRepositoryContract('PostgresReceiptRepository', async () => {
  await resetPg(pool);
  return new PostgresReceiptRepository(pool);
});
