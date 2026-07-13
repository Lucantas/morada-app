import type { Account } from './account';

export interface AccountRepository {
  list(): Promise<Account[]>;
  getById(id: string): Promise<Account | null>;
  save(account: Account): Promise<Account>;
}
