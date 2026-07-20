import type { Account, AccountStatus } from './account';

const STATUS_ORDER: Record<AccountStatus, number> = {
  atrasado: 0,
  pendente: 1,
  pago: 2,
};

export function sortAccountsByDateDesc(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? 1 : -1;
    }
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  });
}
