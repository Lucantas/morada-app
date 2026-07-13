import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runNoticeRepositoryContract } from '../notice-repository.contract';

import { PostgresNoticeRepository } from './notice-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runNoticeRepositoryContract('PostgresNoticeRepository', async () => {
  await resetPg(pool);
  return new PostgresNoticeRepository(pool);
});
