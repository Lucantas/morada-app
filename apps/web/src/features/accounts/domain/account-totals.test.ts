import { buildAccount } from '@/test/factories.accounts';

import { accountTotals } from './account-totals';

describe('accountTotals', () => {
  test('paidCents counts only accounts paid in the current month; dueCents sums all outstanding', () => {
    const totals = accountTotals(
      [
        buildAccount({ status: 'pago', date: '2026-04-05', valueCents: 124000 }),
        buildAccount({ status: 'pago', date: '2026-04-28', valueCents: 89000 }),
        buildAccount({ status: 'pago', date: '2026-03-10', valueCents: 50000 }),
        buildAccount({ status: 'pendente', date: '2026-04-15', valueCents: 45000 }),
        buildAccount({ status: 'atrasado', date: '2026-02-15', valueCents: 30000 }),
      ],
      '2026-04-16',
    );

    expect(totals).toEqual({ paidCents: 213000, dueCents: 75000 });
  });

  test('a paid account with no date is not counted in the month total', () => {
    const totals = accountTotals(
      [buildAccount({ status: 'pago', date: null, valueCents: 10000 })],
      '2026-04-16',
    );

    expect(totals).toEqual({ paidCents: 0, dueCents: 0 });
  });

  test('is all zero for no accounts', () => {
    expect(accountTotals([], '2026-04-16')).toEqual({ paidCents: 0, dueCents: 0 });
  });
});
