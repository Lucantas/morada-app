import type { Income } from './income';
import { sortIncomesByDateDesc } from './sort-incomes';

function income(id: string, date: string | null): Income {
  return {
    id,
    description: `Entrada ${id}`,
    source: 'Fonte',
    date,
    valueCents: 10000,
  };
}

describe('sortIncomesByDateDesc', () => {
  test('orders incomes with the most recent date first', () => {
    const incomes = [
      income('a', '2026-05-10'),
      income('b', '2026-07-25'),
      income('c', '2026-06-01'),
    ];

    expect(sortIncomesByDateDesc(incomes).map((it) => it.id)).toEqual(['b', 'c', 'a']);
  });

  test('places undated incomes first', () => {
    const incomes = [income('a', '2026-07-01'), income('b', null), income('c', '2026-06-01')];

    expect(sortIncomesByDateDesc(incomes).map((it) => it.id)).toEqual(['b', 'a', 'c']);
  });

  test('breaks date ties by id (localeCompare)', () => {
    const incomes = [income('b', '2026-07-10'), income('a', '2026-07-10')];

    expect(sortIncomesByDateDesc(incomes).map((it) => it.id)).toEqual(['a', 'b']);
  });

  test('breaks ties among undated incomes by id', () => {
    const incomes = [income('b', null), income('a', null)];

    expect(sortIncomesByDateDesc(incomes).map((it) => it.id)).toEqual(['a', 'b']);
  });

  test('does not mutate the input array', () => {
    const incomes = [income('a', '2026-05-10'), income('b', '2026-07-25')];

    sortIncomesByDateDesc(incomes);

    expect(incomes.map((it) => it.id)).toEqual(['a', 'b']);
  });
});
