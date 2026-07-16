import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { listIncomes } from './list-incomes';

function fakeRepo(seed: Income[]): IncomeRepository {
  return {
    list: async () => seed,
    getById: async (id) => seed.find((i) => i.id === id) ?? null,
    save: async (income) => income,
    delete: async () => undefined,
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
});
