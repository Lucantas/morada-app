import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runResidentRepositoryContract } from '../resident-repository.contract';

import { PostgresResidentRepository } from './resident-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runResidentRepositoryContract('PostgresResidentRepository', async () => {
  await resetPg(pool);
  return new PostgresResidentRepository(pool);
});
