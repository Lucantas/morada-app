import type { Account, AccountStatus } from './account';

export function effectiveAccountStatus(
  account: Pick<Account, 'status' | 'dueDate'>,
  today: string,
): AccountStatus {
  if (account.status === 'pendente' && account.dueDate && account.dueDate < today) {
    return 'atrasado';
  }
  return account.status;
}

export function overdueCount(accounts: Account[], today: string): number {
  return accounts.filter((account) => effectiveAccountStatus(account, today) === 'atrasado').length;
}
