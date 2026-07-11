import { buildAccount } from '@/test/factories.accounts';

import { accountTotals } from './account-totals';

describe('accountTotals', () => {
  test('sums paid and due (pendente + atrasado) values', () => {
    const totals = accountTotals([
      buildAccount({ status: 'pago', valueCents: 124000 }),
      buildAccount({ status: 'pago', valueCents: 89000 }),
      buildAccount({ status: 'pendente', valueCents: 45000 }),
      buildAccount({ status: 'atrasado', valueCents: 30000 }),
    ]);

    expect(totals).toEqual({ paidCents: 213000, dueCents: 75000 });
  });

  test('is all zero for no accounts', () => {
    expect(accountTotals([])).toEqual({ paidCents: 0, dueCents: 0 });
  });
});
