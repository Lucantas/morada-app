import type { Account } from '../domain/account';

export interface AccountTotals {
  paidCents: number;
  dueCents: number;
}

export function accountTotals(accounts: Account[]): AccountTotals {
  return accounts.reduce<AccountTotals>(
    (totals, account) => {
      if (account.status === 'pago')
        return { ...totals, paidCents: totals.paidCents + account.valueCents };
      return { ...totals, dueCents: totals.dueCents + account.valueCents };
    },
    { paidCents: 0, dueCents: 0 },
  );
}
