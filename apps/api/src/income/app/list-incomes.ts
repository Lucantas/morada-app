import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';
import { sortIncomesByDateDesc } from '../domain/sort-incomes';

export async function listIncomes(repo: IncomeRepository): Promise<Income[]> {
  return sortIncomesByDateDesc(await repo.list());
}
