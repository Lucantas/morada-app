import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';
import { sortAccountsByDateDesc } from '../domain/sort-accounts';

export async function listAccounts(repo: AccountRepository): Promise<Account[]> {
  return sortAccountsByDateDesc(await repo.list());
}
