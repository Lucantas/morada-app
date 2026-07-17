import { incomeMonthlyTotals } from './income-totals';
import type { Income } from './income';

describe('incomeMonthlyTotals', () => {
  test('returns empty object when given an empty array', () => {
    const result = incomeMonthlyTotals([]);
    expect(result).toEqual({});
  });

  test('aggregates single income by month', () => {
    const incomes: Income[] = [
      {
        id: '1',
        description: 'Aluguel',
        source: 'Salão',
        date: '2026-01-15',
        valueCents: 50000,
      },
    ];

    const result = incomeMonthlyTotals(incomes);
    expect(result).toEqual({ '2026-01': 50000 });
  });

  test('sums multiple incomes from the same month', () => {
    const incomes: Income[] = [
      {
        id: '1',
        description: 'Aluguel',
        source: 'Salão',
        date: '2026-01-15',
        valueCents: 30000,
      },
      {
        id: '2',
        description: 'Taxa extra',
        source: 'Salão',
        date: '2026-01-20',
        valueCents: 20000,
      },
    ];

    const result = incomeMonthlyTotals(incomes);
    expect(result).toEqual({ '2026-01': 50000 });
  });

  test('aggregates across multiple months', () => {
    const incomes: Income[] = [
      {
        id: '1',
        description: 'Aluguel janeiro',
        source: 'Salão',
        date: '2026-01-15',
        valueCents: 30000,
      },
      {
        id: '2',
        description: 'Taxa janeiro',
        source: 'Salão',
        date: '2026-01-20',
        valueCents: 20000,
      },
      {
        id: '3',
        description: 'Aluguel fevereiro',
        source: 'Salão',
        date: '2026-02-10',
        valueCents: 30000,
      },
      {
        id: '4',
        description: 'Taxa fevereiro',
        source: 'Salão',
        date: '2026-02-25',
        valueCents: 15000,
      },
    ];

    const result = incomeMonthlyTotals(incomes);
    expect(result).toEqual({
      '2026-01': 50000,
      '2026-02': 45000,
    });
  });

  test('ignores incomes with null date', () => {
    const incomes: Income[] = [
      {
        id: '1',
        description: 'Aluguel',
        source: 'Salão',
        date: '2026-01-15',
        valueCents: 30000,
      },
      {
        id: '2',
        description: 'Sem data',
        source: 'Salão',
        date: null,
        valueCents: 20000,
      },
    ];

    const result = incomeMonthlyTotals(incomes);
    expect(result).toEqual({ '2026-01': 30000 });
  });

  test('ignores incomes with null date and aggregates other months', () => {
    const incomes: Income[] = [
      {
        id: '1',
        description: 'Janeiro',
        source: 'Salão',
        date: '2026-01-15',
        valueCents: 25000,
      },
      {
        id: '2',
        description: 'Sem data',
        source: 'Salão',
        date: null,
        valueCents: 10000,
      },
      {
        id: '3',
        description: 'Fevereiro',
        source: 'Salão',
        date: '2026-02-10',
        valueCents: 35000,
      },
    ];

    const result = incomeMonthlyTotals(incomes);
    expect(result).toEqual({
      '2026-01': 25000,
      '2026-02': 35000,
    });
  });

  test('returns a fresh object on each call', () => {
    const incomes: Income[] = [
      {
        id: '1',
        description: 'Aluguel',
        source: 'Salão',
        date: '2026-01-15',
        valueCents: 50000,
      },
    ];

    const result1 = incomeMonthlyTotals(incomes);
    const result2 = incomeMonthlyTotals(incomes);

    expect(result1).toEqual(result2);
    expect(result1).not.toBe(result2);
  });
});
