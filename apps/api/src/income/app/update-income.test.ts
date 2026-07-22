import { IncomeNotFoundError, IncomeValidationError } from '../domain/errors';
import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { saveIncome } from './save-income';
import { updateIncome } from './update-income';

function fakeRepo(): IncomeRepository & { saved: Income[] } {
  const saved: Income[] = [];
  return {
    saved,
    list: async () => saved,
    getById: async (id) => saved.find((i) => i.id === id) ?? null,
    save: async (income) => {
      const index = saved.findIndex((i) => i.id === income.id);
      if (index === -1) saved.push(income);
      else saved[index] = income;
      return income;
    },
    archive: async (id) => {
      const index = saved.findIndex((i) => i.id === id);
      if (index !== -1) saved.splice(index, 1);
    },
    getProof: async () => null,
  };
}

const validInput = {
  description: 'Aluguel salão de festas',
  source: 'Salão de festas',
  date: '2026-05-10',
  valueCents: 20000,
};

describe('updateIncome', () => {
  test('updates an existing income by id', async () => {
    const repo = fakeRepo();
    const created = await saveIncome(repo, validInput);

    const updated = await updateIncome(repo, created.id, {
      ...validInput,
      description: 'Aluguel atualizado',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.description).toBe('Aluguel atualizado');
    expect(await repo.list()).toHaveLength(1);
  });

  test('throws IncomeNotFoundError when the id does not exist (no create-or-replace)', async () => {
    const repo = fakeRepo();

    await expect(updateIncome(repo, 'ghost-id', validInput)).rejects.toThrow(IncomeNotFoundError);
    expect(await repo.list()).toHaveLength(0);
  });

  test('rejects invalid input for an existing income', async () => {
    const repo = fakeRepo();
    const created = await saveIncome(repo, validInput);

    await expect(updateIncome(repo, created.id, { description: 'x' })).rejects.toThrow(
      IncomeValidationError,
    );
  });
});
