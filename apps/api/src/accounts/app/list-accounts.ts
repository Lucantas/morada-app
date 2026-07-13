import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

export async function listAccounts(repo: AccountRepository): Promise<Account[]> {
  return repo.list();
}
