import { randomUUID } from 'node:crypto';

import { AccountValidationError } from '../domain/errors';
import { accountDraftSchema, accountSchema, type Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

export async function saveAccount(repo: AccountRepository, draft: unknown): Promise<Account> {
  const parsed = accountDraftSchema.safeParse(draft);
  if (!parsed.success) throw new AccountValidationError('Dados da conta inválidos');
  const account = accountSchema.parse({ ...parsed.data, id: parsed.data.id ?? randomUUID() });
  return repo.save(account);
}
