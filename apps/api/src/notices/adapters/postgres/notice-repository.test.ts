import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
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

describe('PostgresNoticeRepository — contract', () => {
  beforeEach(async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
  });

  runNoticeRepositoryContract(
    'PostgresNoticeRepository',
    async (condominiumId) => new PostgresNoticeRepository(pool, condominiumId),
  );
});
