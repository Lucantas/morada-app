import type { Account } from '@/features/accounts/domain/account';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: nextId('account'),
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
    valueCents: 124000,
    status: 'pago',
    ...overrides,
  };
}
