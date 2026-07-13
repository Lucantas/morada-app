import type { Pool } from 'pg';

import { PostgresAccountRepository } from '../accounts/adapters/postgres/account-repository';
import { SqliteAccountRepository } from '../accounts/adapters/sqlite/account-repository';
import type { AccountRepository } from '../accounts/domain/account-repository';
import { PostgresDashboardRepository } from '../dashboard/adapters/postgres/dashboard-repository';
import { SqliteDashboardRepository } from '../dashboard/adapters/sqlite/dashboard-repository';
import type { DashboardRepository } from '../dashboard/domain/dashboard-repository';
import { PostgresThreadRepository } from '../messages/adapters/postgres/thread-repository';
import { SqliteThreadRepository } from '../messages/adapters/sqlite/thread-repository';
import type { ThreadRepository } from '../messages/domain/thread-repository';
import { PostgresNoticeRepository } from '../notices/adapters/postgres/notice-repository';
import { SqliteNoticeRepository } from '../notices/adapters/sqlite/notice-repository';
import type { NoticeRepository } from '../notices/domain/notice-repository';
import { PostgresReceiptRepository } from '../receipts/adapters/postgres/receipt-repository';
import { SqliteReceiptRepository } from '../receipts/adapters/sqlite/receipt-repository';
import type { ReceiptRepository } from '../receipts/domain/receipt-repository';
import { PostgresResidentRepository } from '../residents/adapters/postgres/resident-repository';
import { SqliteResidentRepository } from '../residents/adapters/sqlite/resident-repository';
import type { ResidentRepository } from '../residents/domain/resident-repository';
import { PostgresUserRepository } from '../users/adapters/postgres/user-repository';
import { SqliteUserRepository } from '../users/adapters/sqlite/user-repository';
import type { UserRepository } from '../users/domain/user-repository';

import { createDb, type Db } from './db';
import type { DbDriver } from './config';
import { migrate } from './postgres/migrate';
import { createPool } from './postgres/pool';

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

export function makePostgresRepositories(pool: Pool): Repositories {
  return {
    residents: new PostgresResidentRepository(pool),
    accounts: new PostgresAccountRepository(pool),
    receipts: new PostgresReceiptRepository(pool),
    notices: new PostgresNoticeRepository(pool),
    threads: new PostgresThreadRepository(pool),
    dashboard: new PostgresDashboardRepository(pool),
    users: new PostgresUserRepository(pool),
  };
}

export interface RepositoryBundle {
  repos: Repositories;
  close: () => Promise<void>;
}

export async function createRepositories(cfg: {
  dbDriver: DbDriver;
  dbPath: string;
  databaseUrl?: string;
}): Promise<RepositoryBundle> {
  if (cfg.dbDriver === 'postgres') {
    if (!cfg.databaseUrl) throw new Error('DATABASE_URL must be set when DB_DRIVER=postgres.');
    const pool = createPool(cfg.databaseUrl);
    await migrate(pool);
    return {
      repos: makePostgresRepositories(pool),
      close: async () => {
        await pool.end();
      },
    };
  }

  const db = createDb(cfg.dbPath);
  return {
    repos: makeSqliteRepositories(db),
    close: async () => {
      db.close();
    },
  };
}
