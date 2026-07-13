import { SqliteAccountRepository } from '../accounts/adapters/sqlite/account-repository';
import type { AccountRepository } from '../accounts/domain/account-repository';
import { SqliteDashboardRepository } from '../dashboard/adapters/sqlite/dashboard-repository';
import type { DashboardRepository } from '../dashboard/domain/dashboard-repository';
import { SqliteThreadRepository } from '../messages/adapters/sqlite/thread-repository';
import type { ThreadRepository } from '../messages/domain/thread-repository';
import { SqliteNoticeRepository } from '../notices/adapters/sqlite/notice-repository';
import type { NoticeRepository } from '../notices/domain/notice-repository';
import { SqliteReceiptRepository } from '../receipts/adapters/sqlite/receipt-repository';
import type { ReceiptRepository } from '../receipts/domain/receipt-repository';
import { SqliteResidentRepository } from '../residents/adapters/sqlite/resident-repository';
import type { ResidentRepository } from '../residents/domain/resident-repository';
import { SqliteUserRepository } from '../users/adapters/sqlite/user-repository';
import type { UserRepository } from '../users/domain/user-repository';

import { createDb, type Db } from './db';

// The domain repositories the composition root wires into the app. The driver
// (SQLite or Postgres) is chosen behind this bundle, so ui/app/domain never
// learn which store backs them — the repository-pattern payoff.
export interface Repositories {
  residents: ResidentRepository;
  accounts: AccountRepository;
  receipts: ReceiptRepository;
  notices: NoticeRepository;
  threads: ThreadRepository;
  dashboard: DashboardRepository;
  users: UserRepository;
}

export function makeSqliteRepositories(db: Db): Repositories {
  return {
    residents: new SqliteResidentRepository(db),
    accounts: new SqliteAccountRepository(db),
    receipts: new SqliteReceiptRepository(db),
    notices: new SqliteNoticeRepository(db),
    threads: new SqliteThreadRepository(db),
    dashboard: new SqliteDashboardRepository(db),
    users: new SqliteUserRepository(db),
  };
}

export interface RepositoryBundle {
  repos: Repositories;
  close: () => Promise<void>;
}

export async function createRepositories(cfg: { dbPath: string }): Promise<RepositoryBundle> {
  const db = createDb(cfg.dbPath);
  return {
    repos: makeSqliteRepositories(db),
    close: async () => {
      db.close();
    },
  };
}
