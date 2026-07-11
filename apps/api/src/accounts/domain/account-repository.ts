import type { Account } from './account';

export interface AccountRepository {
  list(): Account[];
  getById(id: string): Account | null;
  save(account: Account): Account;
}
