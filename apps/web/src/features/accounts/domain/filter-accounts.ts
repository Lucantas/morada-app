import type { Account } from './account';

export type AccountFilters = {
  query: string;
  category: string;
  from: string;
  to: string;
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matchesQuery(account: Account, query: string): boolean {
  if (!query) return true;
  return normalize(account.description).includes(normalize(query));
}

function matchesCategory(account: Account, category: string): boolean {
  if (!category) return true;
  return account.category === category;
}

function matchesDateRange(account: Account, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!account.date) return false;
  if (from && account.date < from) return false;
  if (to && account.date > to) return false;
  return true;
}

export function filterAccounts(accounts: Account[], filters: AccountFilters): Account[] {
  return accounts.filter(
    (account) =>
      matchesQuery(account, filters.query) &&
      matchesCategory(account, filters.category) &&
      matchesDateRange(account, filters.from, filters.to),
  );
}
