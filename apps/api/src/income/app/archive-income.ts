import { IncomeNotFoundError } from '../domain/errors';
import type { IncomeRepository } from '../domain/income-repository';

export async function archiveIncome(repo: IncomeRepository, id: string): Promise<void> {
  const income = await repo.getById(id);
  if (!income) throw new IncomeNotFoundError(id);
  await repo.archive(id);
}
