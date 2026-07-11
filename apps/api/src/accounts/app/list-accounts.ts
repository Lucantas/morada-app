import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

export function listAccounts(repo: AccountRepository): Account[] {
  return repo.list();
}
