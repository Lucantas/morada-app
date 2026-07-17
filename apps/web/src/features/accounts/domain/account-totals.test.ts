import { buildAccount } from '@/test/factories.accounts';

import { accountMonths, accountTotals, monthlyExpenseCents } from './account-totals';

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

describe('monthlyExpenseCents', () => {
  test('sums valueCents for accounts in the target month', () => {
    const result = monthlyExpenseCents(
      [
        buildAccount({ date: '2026-04-05', valueCents: 100000 }),
        buildAccount({ date: '2026-04-15', valueCents: 50000 }),
        buildAccount({ date: '2026-05-10', valueCents: 75000 }),
      ],
      '2026-04',
    );
    expect(result).toBe(150000);
  });

  test('excludes accounts with null date', () => {
    const result = monthlyExpenseCents(
      [
        buildAccount({ date: '2026-04-05', valueCents: 100000 }),
        buildAccount({ date: null, valueCents: 50000 }),
      ],
      '2026-04',
    );
    expect(result).toBe(100000);
  });

  test('returns 0 when no accounts match the month', () => {
    const result = monthlyExpenseCents(
      [
        buildAccount({ date: '2026-04-05', valueCents: 100000 }),
        buildAccount({ date: '2026-05-10', valueCents: 75000 }),
      ],
      '2026-03',
    );
    expect(result).toBe(0);
  });

  test('returns 0 for empty account list', () => {
    expect(monthlyExpenseCents([], '2026-04')).toBe(0);
  });

  test('handles different months correctly', () => {
    const accounts = [
      buildAccount({ date: '2026-01-05', valueCents: 10000 }),
      buildAccount({ date: '2026-02-10', valueCents: 20000 }),
      buildAccount({ date: '2026-03-15', valueCents: 30000 }),
    ];
    expect(monthlyExpenseCents(accounts, '2026-01')).toBe(10000);
    expect(monthlyExpenseCents(accounts, '2026-02')).toBe(20000);
    expect(monthlyExpenseCents(accounts, '2026-03')).toBe(30000);
  });
});

describe('accountMonths', () => {
  test('returns sorted unique months from account dates', () => {
    const result = accountMonths([
      buildAccount({ date: '2026-05-10' }),
      buildAccount({ date: '2026-04-05' }),
      buildAccount({ date: '2026-05-20' }),
      buildAccount({ date: '2026-03-15' }),
    ]);
    expect(result).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  test('returns empty array when all dates are null', () => {
    const result = accountMonths([buildAccount({ date: null }), buildAccount({ date: null })]);
    expect(result).toEqual([]);
  });

  test('returns empty array for empty account list', () => {
    expect(accountMonths([])).toEqual([]);
  });

  test('excludes null dates but includes non-null ones', () => {
    const result = accountMonths([
      buildAccount({ date: '2026-04-05' }),
      buildAccount({ date: null }),
      buildAccount({ date: '2026-04-10' }),
      buildAccount({ date: '2026-03-15' }),
      buildAccount({ date: null }),
    ]);
    expect(result).toEqual(['2026-03', '2026-04']);
  });

  test('deduplicates months from multiple accounts in the same month', () => {
    const result = accountMonths([
      buildAccount({ date: '2026-04-05' }),
      buildAccount({ date: '2026-04-10' }),
      buildAccount({ date: '2026-04-20' }),
    ]);
    expect(result).toEqual(['2026-04']);
  });

  test('handles multi-year months correctly', () => {
    const result = accountMonths([
      buildAccount({ date: '2025-12-15' }),
      buildAccount({ date: '2026-01-05' }),
      buildAccount({ date: '2026-02-10' }),
    ]);
    expect(result).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});
