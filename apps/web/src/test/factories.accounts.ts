import type { Account } from '@/features/accounts/domain/account';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: nextId('account'),
    description: 'Água — abril',
    category: 'Utilidades',
    dateLabel: '05/04',
    valueCents: 124000,
    status: 'pago',
    ...overrides,
  };
}
