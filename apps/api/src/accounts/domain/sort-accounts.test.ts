import type { Account, AccountStatus } from './account';
import { sortAccountsByDateDesc } from './sort-accounts';

function account(id: string, date: string | null, status: AccountStatus = 'pago'): Account {
  return {
    id,
    description: `Conta ${id}`,
    category: 'Utilidades',
    date,
    valueCents: 10000,
    status,
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

  test('places undated accounts first (freshly added, still pending)', () => {
    const accounts = [account('a', '2026-07-01'), account('b', null), account('c', '2026-06-01')];

    expect(sortAccountsByDateDesc(accounts).map((it) => it.id)).toEqual(['b', 'a', 'c']);
  });

  test('breaks date ties by status (atrasado, then pendente, then pago)', () => {
    const accounts = [
      account('a', '2026-07-10', 'pago'),
      account('b', '2026-07-10', 'atrasado'),
      account('c', '2026-07-10', 'pendente'),
    ];

    expect(sortAccountsByDateDesc(accounts).map((it) => it.id)).toEqual(['b', 'c', 'a']);
  });

  test('does not mutate the input array', () => {
    const accounts = [account('a', '2026-05-10'), account('b', '2026-07-25')];

    sortAccountsByDateDesc(accounts);

    expect(accounts.map((it) => it.id)).toEqual(['a', 'b']);
  });
});
