import { AccountNotFoundError } from '../domain/errors';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

export function getAccount(repo: AccountRepository, id: string): Account {
  const account = repo.getById(id);
  if (!account) throw new AccountNotFoundError(id);
  return account;
}
