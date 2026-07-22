import { IncomeNotFoundError } from '../domain/errors';
import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { archiveIncome } from './archive-income';

function fakeRepo(): IncomeRepository & { saved: Income[] } {
  const saved: Income[] = [];
  return {
    saved,
    list: async () => saved,
    getById: async (id) => saved.find((i) => i.id === id) ?? null,
    save: async (income) => {
      saved.push(income);
      return income;
    },
    archive: async (id) => {
      const index = saved.findIndex((i) => i.id === id);
      if (index !== -1) saved.splice(index, 1);
    },
    getProof: async () => null,
  };
}

describe('archiveIncome', () => {
  test('archives an existing income', async () => {
    const repo = fakeRepo();
    await repo.save({
      id: 'i-1',
      description: 'Aluguel salão',
      source: 'Salão de festas',
      date: '2026-05-10',
      valueCents: 20000,
    });

    await archiveIncome(repo, 'i-1');

    expect(await repo.getById('i-1')).toBeNull();
  });

  test('throws IncomeNotFoundError for an unknown id', async () => {
    await expect(archiveIncome(fakeRepo(), 'nope')).rejects.toThrow(IncomeNotFoundError);
  });
});
