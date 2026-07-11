import type { Account } from './account';

export type AccountTotals = { paidCents: number; dueCents: number };

export function accountTotals(accounts: Account[]): AccountTotals {
  return accounts.reduce<AccountTotals>(
    (totals, account) =>
      account.status === 'pago'
        ? { ...totals, paidCents: totals.paidCents + account.valueCents }
        : { ...totals, dueCents: totals.dueCents + account.valueCents },
    { paidCents: 0, dueCents: 0 },
  );
}
