import { AccountNotFoundError } from '../domain/errors';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

export async function getAccount(repo: AccountRepository, id: string): Promise<Account> {
  const account = await repo.getById(id);
  if (!account) throw new AccountNotFoundError(id);
  return account;
}
