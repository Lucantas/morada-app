import { IncomeNotFoundError } from '../domain/errors';
import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { getIncome } from './get-income';

function fakeRepo(seed: Income[]): IncomeRepository {
  return {
    list: async () => seed,
    getById: async (id) => seed.find((i) => i.id === id) ?? null,
    save: async (income) => income,
    archive: async () => undefined,
    getProof: async () => null,
  };
}

describe('getIncome', () => {
  test('returns the income when it exists', async () => {
    const income: Income = {
      id: 'i-1',
      description: 'Aluguel salão',
      source: 'Salão de festas',
      date: '2026-05-10',
      valueCents: 20000,
    };

    const result = await getIncome(fakeRepo([income]), 'i-1');

    expect(result).toEqual(income);
  });

  test('throws IncomeNotFoundError for an unknown id', async () => {
    await expect(getIncome(fakeRepo([]), 'nope')).rejects.toThrow(IncomeNotFoundError);
  });
});
