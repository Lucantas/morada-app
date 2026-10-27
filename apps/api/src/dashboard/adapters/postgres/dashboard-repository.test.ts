import { PostgresAccountRepository } from '../../../accounts/adapters/postgres/account-repository';
import { PostgresIncomeRepository } from '../../../income/adapters/postgres/income-repository';
import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { PostgresReceiptRepository } from '../../../receipts/adapters/postgres/receipt-repository';
import { PostgresSettingsRepository } from '../../../settings/adapters/postgres/settings-repository';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runDashboardRepositoryContract } from '../dashboard-repository.contract';

import { PostgresDashboardRepository } from './dashboard-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('PostgresDashboardRepository — contract', () => {
  beforeEach(async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
  });

  runDashboardRepositoryContract('PostgresDashboardRepository', async (condominiumId) => ({
    dashboard: new PostgresDashboardRepository(pool, condominiumId),
    accounts: new PostgresAccountRepository(pool, condominiumId, null),
    receipts: new PostgresReceiptRepository(pool, condominiumId, null),
    incomes: new PostgresIncomeRepository(pool, condominiumId, null),
    settings: new PostgresSettingsRepository(pool, condominiumId),
  }));
});
