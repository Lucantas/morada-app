import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import { runOrganizationRepositoryContract } from '../organization-repository.contract';

import { PostgresOrganizationRepository } from './organization-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runOrganizationRepositoryContract('PostgresOrganizationRepository', async () => {
  await resetPg(pool);
  return { repo: new PostgresOrganizationRepository(pool), pool };
});
