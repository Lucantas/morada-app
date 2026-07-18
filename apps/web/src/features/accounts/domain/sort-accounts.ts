import type { Account } from './account';

export function sortAccountsByDateDesc(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    if (a.date === b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? 1 : -1;
  });
}
