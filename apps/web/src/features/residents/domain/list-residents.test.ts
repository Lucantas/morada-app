import { buildResident } from '@/test/factories';

import { listResidents } from './list-residents';
import type { Resident } from './resident';
import type { ResidentRepository } from './resident-repository';

function fakeRepo(residents: Resident[]): ResidentRepository {
  return {
    list: async () => residents,
    getById: async (id) => residents.find((r) => r.id === id) ?? null,
    getCurrent: async (subject) => residents.find((r) => r.id === subject) ?? null,
    listByApartment: async (aid) => residents.filter((r) => r.apartmentId === aid),
    save: async (r) => r,
    deactivate: async () => {},
    setStatusOverride: async () => {},
  };
}

describe('listResidents', () => {
  test('orders residents by apartment number (numeric, not lexical)', async () => {
    const repo = fakeRepo([
      buildResident({ name: 'Bruno', apt: 'Apto 10' }),
      buildResident({ name: 'Ana', apt: 'Apto 2' }),
      buildResident({ name: 'Carla', apt: 'Apto 100' }),
    ]);

    const result = await listResidents(repo);

    expect(result.map((r) => r.apt)).toEqual(['Apto 2', 'Apto 10', 'Apto 100']);
  });

  test('returns an empty array when there are no residents', async () => {
    expect(await listResidents(fakeRepo([]))).toEqual([]);
  });
});
