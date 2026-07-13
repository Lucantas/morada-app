import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runUserRepositoryContract } from '../user-repository.contract';

import { PostgresUserRepository } from './user-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runUserRepositoryContract('PostgresUserRepository', async () => {
  await resetPg(pool);
  return new PostgresUserRepository(pool);
});
