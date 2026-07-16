import { IncomeNotFoundError } from '../domain/errors';
import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { saveIncome } from './save-income';

export async function updateIncome(
  repo: IncomeRepository,
  id: string,
  draft: unknown,
): Promise<Income> {
  const existing = await repo.getById(id);
  if (!existing) throw new IncomeNotFoundError(id);
  return saveIncome(repo, { ...(draft as Record<string, unknown>), id });
}
