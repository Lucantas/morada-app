import type { Resident } from '@/features/residents/domain/resident';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function buildResident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: nextId('resident'),
    name: 'Maria Ribeiro',
    apt: 'Apto 302',
    phone: '(11) 90000-0000',
    email: 'maria@email.com',
    status: 'em_dia',
    ...overrides,
  };
}
