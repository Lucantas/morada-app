import type { Account } from './account';
import type { AccountRepository } from './account-repository';

export async function listAccounts(repository: AccountRepository): Promise<Account[]> {
  return repository.list();
}
