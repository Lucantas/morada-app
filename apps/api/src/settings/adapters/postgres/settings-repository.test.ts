import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runSettingsRepositoryContract } from '../settings-repository.contract';

import { PostgresSettingsRepository } from './settings-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('PostgresSettingsRepository — contract', () => {
  beforeEach(async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
  });

  runSettingsRepositoryContract(
    'PostgresSettingsRepository',
    async (condominiumId) => new PostgresSettingsRepository(pool, condominiumId),
  );
});
