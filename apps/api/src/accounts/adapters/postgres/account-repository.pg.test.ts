import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
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
  return new PostgresAccountRepository(pool);
});
