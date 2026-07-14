import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runThreadRepositoryContract } from '../thread-repository.contract';

import { PostgresThreadRepository } from './thread-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runThreadRepositoryContract('PostgresThreadRepository', async () => {
  await resetPg(pool);
  return new PostgresThreadRepository(pool);
});
