import type { Pool } from 'pg';

import { PostgresAccountRepository } from '../accounts/adapters/postgres/account-repository';
import type { AccountRepository } from '../accounts/domain/account-repository';
import { PostgresDashboardRepository } from '../dashboard/adapters/postgres/dashboard-repository';
import type { DashboardRepository } from '../dashboard/domain/dashboard-repository';
import { PostgresThreadRepository } from '../messages/adapters/postgres/thread-repository';
import type { ThreadRepository } from '../messages/domain/thread-repository';
import { PostgresNoticeRepository } from '../notices/adapters/postgres/notice-repository';
import type { NoticeRepository } from '../notices/domain/notice-repository';
import { PostgresReceiptRepository } from '../receipts/adapters/postgres/receipt-repository';
import type { ReceiptRepository } from '../receipts/domain/receipt-repository';
import { PostgresResidentRepository } from '../residents/adapters/postgres/resident-repository';
import type { ResidentRepository } from '../residents/domain/resident-repository';
import { PostgresSettingsRepository } from '../settings/adapters/postgres/settings-repository';
import type { SettingsRepository } from '../settings/domain/settings-repository';
import { PostgresUserRepository } from '../users/adapters/postgres/user-repository';
import type { UserRepository } from '../users/domain/user-repository';

import { migrate } from './postgres/migrate';
import { createPool } from './postgres/pool';

// The domain repositories the composition root wires into the app, backed by
// Postgres. ui/app/domain depend only on the interfaces, never on the store.
export interface Repositories {
  residents: ResidentRepository;
  accounts: AccountRepository;
  receipts: ReceiptRepository;
  notices: NoticeRepository;
  threads: ThreadRepository;
  dashboard: DashboardRepository;
  users: UserRepository;
  settings: SettingsRepository;
}

export function makePostgresRepositories(pool: Pool): Repositories {
  return {
    residents: new PostgresResidentRepository(pool),
    accounts: new PostgresAccountRepository(pool),
    receipts: new PostgresReceiptRepository(pool),
    notices: new PostgresNoticeRepository(pool),
    threads: new PostgresThreadRepository(pool),
    dashboard: new PostgresDashboardRepository(pool),
    users: new PostgresUserRepository(pool),
    settings: new PostgresSettingsRepository(pool),
  };
}

export interface RepositoryBundle {
  repos: Repositories;
  close: () => Promise<void>;
}

export async function createRepositories(cfg: { databaseUrl: string }): Promise<RepositoryBundle> {
  const pool = createPool(cfg.databaseUrl);
  await migrate(pool);
  return {
    repos: makePostgresRepositories(pool),
    close: async () => {
      await pool.end();
    },
  };
}
