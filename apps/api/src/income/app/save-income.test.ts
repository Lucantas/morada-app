import { IncomeValidationError } from '../domain/errors';
import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { saveIncome } from './save-income';

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
    delete: async (id) => {
      const index = saved.findIndex((i) => i.id === id);
      if (index !== -1) saved.splice(index, 1);
    },
  };
}

const validInput = {
  description: 'Aluguel salão de festas',
  source: 'Salão de festas',
  date: '2026-05-10',
  valueCents: 20000,
};

describe('saveIncome', () => {
  test('creates an income with a generated id', async () => {
    const repo = fakeRepo();
    const income = await saveIncome(repo, validInput);

    expect(income.id).toMatch(/.+/);
    expect(income.description).toBe('Aluguel salão de festas');
    expect(income.valueCents).toBe(20000);
    expect(await repo.getById(income.id)).toEqual(income);
  });

  test('rejects invalid input', async () => {
    await expect(saveIncome(fakeRepo(), { description: 'Falta campos' })).rejects.toThrow(
      IncomeValidationError,
    );
  });

  test('an update keeps the given id', async () => {
    const repo = fakeRepo();
    const created = await saveIncome(repo, validInput);

    const updated = await saveIncome(repo, {
      ...validInput,
      id: created.id,
      description: 'Aluguel atualizado',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.description).toBe('Aluguel atualizado');
    expect(await repo.list()).toHaveLength(1);
  });

  test('rejects a null date', async () => {
    await expect(
      saveIncome(fakeRepo(), {
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: null,
        valueCents: 20000,
      }),
    ).rejects.toThrow(IncomeValidationError);
  });

  test('rejects a missing date', async () => {
    await expect(
      saveIncome(fakeRepo(), {
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        valueCents: 20000,
      }),
    ).rejects.toThrow(IncomeValidationError);
  });

  test('rejects an empty string date', async () => {
    await expect(
      saveIncome(fakeRepo(), {
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: '',
        valueCents: 20000,
      }),
    ).rejects.toThrow(IncomeValidationError);
  });

  test('rejects a date with an invalid month', async () => {
    await expect(
      saveIncome(fakeRepo(), {
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: '2026-13-40',
        valueCents: 20000,
      }),
    ).rejects.toThrow(IncomeValidationError);
  });

  test('rejects a date that does not exist on the calendar', async () => {
    await expect(
      saveIncome(fakeRepo(), {
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: '2026-02-31',
        valueCents: 20000,
      }),
    ).rejects.toThrow(IncomeValidationError);
  });
});
