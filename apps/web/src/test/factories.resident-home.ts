import type { CurrentResident } from '@/features/resident-home/ui/current-resident';

export function buildCurrentResident(overrides: Partial<CurrentResident> = {}): CurrentResident {
  return {
    name: 'Maria Ribeiro',
    apt: 'Apto 302',
    phone: '(21) 99876-5432',
    email: 'maria.ribeiro@email.com',
    ...overrides,
  };
}
