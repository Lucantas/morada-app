import { SqliteAccountRepository } from '../../../accounts/adapters/sqlite/account-repository';
import { createTestDb } from '../../../platform/db';
import { SqliteReceiptRepository } from '../../../receipts/adapters/sqlite/receipt-repository';
import { runDashboardRepositoryContract } from '../dashboard-repository.contract';

import { SqliteDashboardRepository } from './dashboard-repository';

runDashboardRepositoryContract('SqliteDashboardRepository', async () => {
  const db = createTestDb();
  return {
    dashboard: new SqliteDashboardRepository(db),
    accounts: new SqliteAccountRepository(db),
    receipts: new SqliteReceiptRepository(db),
  };
});
