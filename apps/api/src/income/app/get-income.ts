import { IncomeNotFoundError } from '../domain/errors';
import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

export async function getIncome(repo: IncomeRepository, id: string): Promise<Income> {
  const income = await repo.getById(id);
  if (!income) throw new IncomeNotFoundError(id);
  return income;
}
