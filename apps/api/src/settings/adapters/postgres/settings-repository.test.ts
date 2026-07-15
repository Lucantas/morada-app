import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { insertRows, resetPg } from '../../../test-support/pg';
import { runSettingsRepositoryContract } from '../settings-repository.contract';

import { PostgresSettingsRepository } from './settings-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runSettingsRepositoryContract('PostgresSettingsRepository', async () => {
  await resetPg(pool);
  await insertRows(
    pool,
    'condo_settings',
    ['id', 'monthly_fee_cents', 'due_day'],
    [{ id: 'default', monthly_fee_cents: 15000, due_day: 15 }],
  );
  return new PostgresSettingsRepository(pool);
});
