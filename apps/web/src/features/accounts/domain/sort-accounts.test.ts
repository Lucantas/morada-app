import type { Account } from './account';
import { sortAccountsByDateDesc } from './sort-accounts';

function account(id: string, date: string | null): Account {
  return {
    id,
    description: `Conta ${id}`,
    category: 'Utilidades',
    date,
    valueCents: 10000,
    status: 'pago',
  };
}

describe('sortAccountsByDateDesc', () => {
  test('orders accounts with the most recent date first', () => {
    const accounts = [
      account('a', '2026-05-10'),
      account('b', '2026-07-25'),
      account('c', '2026-06-01'),
    ];

    expect(sortAccountsByDateDesc(accounts).map((it) => it.id)).toEqual(['b', 'c', 'a']);
  });

  test('places undated accounts last', () => {
    const accounts = [account('a', null), account('b', '2026-07-01'), account('c', null)];

    expect(sortAccountsByDateDesc(accounts).map((it) => it.id)).toEqual(['b', 'a', 'c']);
  });

  test('does not mutate the input array', () => {
    const accounts = [account('a', '2026-05-10'), account('b', '2026-07-25')];

    sortAccountsByDateDesc(accounts);

    expect(accounts.map((it) => it.id)).toEqual(['a', 'b']);
  });
});
