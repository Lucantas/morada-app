import { buildResident } from '@/test/factories';

import { listResidents } from './list-residents';
import type { Resident } from './resident';
import type { ResidentRepository } from './resident-repository';

function fakeRepo(residents: Resident[]): ResidentRepository {
  return {
    list: async () => residents,
    getById: async (id) => residents.find((r) => r.id === id) ?? null,
    save: async (r) => r,
  };
}

describe('listResidents', () => {
  test('returns residents sorted by name', async () => {
    const repo = fakeRepo([
      buildResident({ name: 'Bruno' }),
      buildResident({ name: 'Ana' }),
      buildResident({ name: 'Carla' }),
    ]);

    const result = await listResidents(repo);

    expect(result.map((r) => r.name)).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  test('returns an empty array when there are no residents', async () => {
    expect(await listResidents(fakeRepo([]))).toEqual([]);
  });
});
