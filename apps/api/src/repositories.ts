import type { Pool } from 'pg';

import { PostgresAccountRepository } from './accounts/adapters/postgres/account-repository';
import type { AccountRepository } from './accounts/domain/account-repository';
import { PostgresCategoryRepository } from './categories/adapters/postgres/category-repository';
import type { CategoryRepository } from './categories/domain/category-repository';
import { PostgresCondoRepository } from './condos/adapters/postgres/condo-repository';
import type { CondoRepository } from './condos/domain/condo-repository';
import { PostgresDashboardRepository } from './dashboard/adapters/postgres/dashboard-repository';
import type { DashboardRepository } from './dashboard/domain/dashboard-repository';
import { PostgresIncomeRepository } from './income/adapters/postgres/income-repository';
import type { IncomeRepository } from './income/domain/income-repository';
import { PostgresThreadRepository } from './messages/adapters/postgres/thread-repository';
import type { ThreadRepository } from './messages/domain/thread-repository';
import { PostgresNoticeRepository } from './notices/adapters/postgres/notice-repository';
import type { NoticeRepository } from './notices/domain/notice-repository';
import { PostgresReceiptRepository } from './receipts/adapters/postgres/receipt-repository';
import type { ReceiptRepository } from './receipts/domain/receipt-repository';
import { PostgresResidentRepository } from './residents/adapters/postgres/resident-repository';
import type { ResidentRepository } from './residents/domain/resident-repository';
import { PostgresSettingsRepository } from './settings/adapters/postgres/settings-repository';
import type { SettingsRepository } from './settings/domain/settings-repository';
import { PostgresAuthTokenRepository } from './users/adapters/postgres/auth-token-repository';
import { PostgresUserRepository } from './users/adapters/postgres/user-repository';
import type { AuthTokenRepository } from './users/domain/auth-token-repository';
import type { UserRepository } from './users/domain/user-repository';

import { migrate } from './platform/postgres/migrate';
import { createPool } from './platform/postgres/pool';
import { config } from './platform/config';
import { R2ProofStorage } from './receipts/adapters/r2/r2-proof-storage';

export interface CondoRepositories {
  residents: ResidentRepository;
  accounts: AccountRepository;
  receipts: ReceiptRepository;
  notices: NoticeRepository;
  threads: ThreadRepository;
  dashboard: DashboardRepository;
  settings: SettingsRepository;
  categories: CategoryRepository;
  incomes: IncomeRepository;
}

export interface Repositories {
  forCondo(condominiumId: string): CondoRepositories;
  users: UserRepository;
  authTokens: AuthTokenRepository;
  condos: CondoRepository;
}

export function makePostgresRepositories(pool: Pool): Repositories {
  const proofStorage = config.r2 ? new R2ProofStorage(config.r2) : null;
  return {
    forCondo: (condominiumId) => ({
      residents: new PostgresResidentRepository(pool, condominiumId),
      accounts: new PostgresAccountRepository(pool, condominiumId, proofStorage),
      receipts: new PostgresReceiptRepository(pool, condominiumId, proofStorage),
      notices: new PostgresNoticeRepository(pool, condominiumId),
      threads: new PostgresThreadRepository(pool, condominiumId),
      dashboard: new PostgresDashboardRepository(pool, condominiumId),
      settings: new PostgresSettingsRepository(pool, condominiumId),
      categories: new PostgresCategoryRepository(pool, condominiumId),
      incomes: new PostgresIncomeRepository(pool, condominiumId, proofStorage),
    }),
    users: new PostgresUserRepository(pool),
    authTokens: new PostgresAuthTokenRepository(pool),
    condos: new PostgresCondoRepository(pool),
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
