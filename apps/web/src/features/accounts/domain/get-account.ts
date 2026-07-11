import { AccountNotFoundError } from './errors';
import type { Account } from './account';
import type { AccountRepository } from './account-repository';

export async function getAccount(repository: AccountRepository, id: string): Promise<Account> {
  const account = await repository.getById(id);
  if (!account) throw new AccountNotFoundError(id);
  return account;
}
