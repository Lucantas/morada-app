import { PostgresAccountRepository } from '../../../accounts/adapters/postgres/account-repository';
import { PostgresIncomeRepository } from '../../../income/adapters/postgres/income-repository';
import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { PostgresReceiptRepository } from '../../../receipts/adapters/postgres/receipt-repository';
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

runDashboardRepositoryContract('PostgresDashboardRepository', async () => {
  await resetPg(pool);
  return {
    dashboard: new PostgresDashboardRepository(pool),
    accounts: new PostgresAccountRepository(pool, null),
    receipts: new PostgresReceiptRepository(pool, null),
    incomes: new PostgresIncomeRepository(pool, null),
  };
});
