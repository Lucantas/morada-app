import type { Account } from './account';

export type AccountTotals = { paidCents: number; dueCents: number };

export function accountTotals(accounts: Account[], today: string): AccountTotals {
  const month = today.slice(0, 7);
  return accounts.reduce<AccountTotals>(
    (totals, account) => {
      if (account.status === 'pago') {
        return account.date?.slice(0, 7) === month
          ? { ...totals, paidCents: totals.paidCents + account.valueCents }
          : totals;
      }
      return { ...totals, dueCents: totals.dueCents + account.valueCents };
    },
    { paidCents: 0, dueCents: 0 },
  );
}

export function monthlyExpenseCents(accounts: Account[], month: string): number {
  return accounts.reduce<number>((total, account) => {
    if (account.date?.slice(0, 7) === month) {
      return total + account.valueCents;
    }
    return total;
  }, 0);
}

export function accountMonths(accounts: Account[]): string[] {
  const months = new Set<string>();
  for (const account of accounts) {
    if (account.date) {
      months.add(account.date.slice(0, 7));
    }
  }
  return Array.from(months).sort();
}
