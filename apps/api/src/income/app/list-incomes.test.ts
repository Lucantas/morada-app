import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { listIncomes } from './list-incomes';

function fakeRepo(seed: Income[]): IncomeRepository {
  return {
    list: async () => seed,
    getById: async (id) => seed.find((i) => i.id === id) ?? null,
    save: async (income) => income,
    archive: async () => undefined,
  };
}

describe('listIncomes', () => {
  test('returns the incomes from the repository', async () => {
    const income: Income = {
      id: 'i-1',
      description: 'Aluguel salão',
      source: 'Salão de festas',
      date: '2026-05-10',
      valueCents: 20000,
    };

    const result = await listIncomes(fakeRepo([income]));

    expect(result).toEqual([income]);
  });

  test('returns incomes ordered by date, most recent first', async () => {
    const older: Income = {
      id: 'i-1',
      description: 'Entrada antiga',
      source: 'Fonte A',
      date: '2026-05-10',
      valueCents: 10000,
    };
    const newer: Income = {
      id: 'i-2',
      description: 'Entrada recente',
      source: 'Fonte B',
      date: '2026-07-01',
      valueCents: 20000,
    };

    const result = await listIncomes(fakeRepo([older, newer]));

    expect(result.map((it) => it.id)).toEqual(['i-2', 'i-1']);
  });
});
