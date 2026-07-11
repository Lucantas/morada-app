import { accountDraftSchema, accountSchema, type Account, type AccountDraft } from './account';
import type { AccountRepository } from './account-repository';
import { AccountValidationError } from './errors';

export async function saveAccount(
  repository: AccountRepository,
  draft: AccountDraft,
): Promise<Account> {
  const parsedDraft = accountDraftSchema.safeParse(draft);
  if (!parsedDraft.success) {
    throw new AccountValidationError('Dados da conta inválidos');
  }
  const account = accountSchema.parse({
    ...parsedDraft.data,
    id: parsedDraft.data.id ?? crypto.randomUUID(),
  });
  return repository.save(account);
}
