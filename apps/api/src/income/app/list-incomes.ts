import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

export async function listIncomes(repo: IncomeRepository): Promise<Income[]> {
  return repo.list();
}
