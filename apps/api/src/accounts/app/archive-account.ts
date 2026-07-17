import { AccountNotFoundError } from '../domain/errors';
import type { AccountRepository } from '../domain/account-repository';

export async function archiveAccount(repo: AccountRepository, id: string): Promise<void> {
  const existing = await repo.getById(id);
  if (!existing) throw new AccountNotFoundError(id);
  await repo.archive(id);
}
