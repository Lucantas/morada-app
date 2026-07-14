import type { Account } from '../domain/account';

import { accountTotals } from './account-totals';

const build = (over: Partial<Account>): Account => ({
  id: 'x',
  description: 'Conta',
  category: 'Geral',
  date: '2026-04-05',
  valueCents: 1000,
  status: 'pendente',
  ...over,
});

describe('accountTotals', () => {
  test('sums paid and due amounts', () => {
    const totals = accountTotals([
      build({ id: '1', status: 'pago', valueCents: 1000 }),
      build({ id: '2', status: 'pago', valueCents: 500 }),
      build({ id: '3', status: 'pendente', valueCents: 300 }),
      build({ id: '4', status: 'atrasado', valueCents: 200 }),
    ]);
    expect(totals).toEqual({ paidCents: 1500, dueCents: 500 });
  });

  test('returns zeros for an empty list', () => {
    expect(accountTotals([])).toEqual({ paidCents: 0, dueCents: 0 });
  });
});
