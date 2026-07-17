import type { Account } from './account';

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

export function resolveSelectedMonth(
  monthOverride: string | null,
  months: string[],
  fallbackMonth: string,
): string {
  if (monthOverride !== null && months.includes(monthOverride)) {
    return monthOverride;
  }
  return months.at(-1) ?? fallbackMonth;
}
