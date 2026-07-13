import { buildResident } from '@/test/factories';

import { filterResidents } from './filter-residents';

const residents = [
  buildResident({ id: 'r-1', name: 'Maria Ribeiro', apt: 'Apto 302' }),
  buildResident({ id: 'r-2', name: 'João Pereira', apt: 'Apto 101' }),
  buildResident({ id: 'r-3', name: 'Ana Costa', apt: 'Apto 202' }),
];

describe('filterResidents', () => {
  test('returns all residents when the query is blank', () => {
    expect(filterResidents(residents, '   ')).toHaveLength(3);
  });

  test('matches by name, case-insensitively', () => {
    expect(filterResidents(residents, 'maria').map((r) => r.id)).toEqual(['r-1']);
    expect(filterResidents(residents, 'ANA').map((r) => r.id)).toEqual(['r-3']);
  });

  test('matches by apartment', () => {
    expect(filterResidents(residents, '101').map((r) => r.id)).toEqual(['r-2']);
  });

  test('returns an empty list when nothing matches', () => {
    expect(filterResidents(residents, 'zzz')).toEqual([]);
  });
});
