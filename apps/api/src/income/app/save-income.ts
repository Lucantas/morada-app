import { randomUUID } from 'node:crypto';

import { IncomeValidationError } from '../domain/errors';
import { incomeDraftSchema, incomeSchema, type Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

export async function saveIncome(repo: IncomeRepository, draft: unknown): Promise<Income> {
  const parsed = incomeDraftSchema.safeParse(draft);
  if (!parsed.success) throw new IncomeValidationError('Dados da entrada inválidos');
  const income = incomeSchema.parse({ ...parsed.data, id: parsed.data.id ?? randomUUID() });
  return repo.save(income);
}
