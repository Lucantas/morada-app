import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { listResidents } from './list-residents';

function fakeRepo(list: Resident[]): ResidentRepository {
  const map = new Map(list.map((r) => [r.id, r]));
  return {
    list: async () => [...map.values()].filter((r) => r.active),
    getById: async (id) => map.get(id) ?? null,
    listByApartment: async (aid) => [...map.values()].filter((r) => r.apartmentId === aid),
    apartmentOf: async (id) => {
      const r = map.get(id);
      return r ? { apartmentId: r.apartmentId, apt: r.apt } : null;
    },
    save: async (input) => {
      const resident: Resident = { ...input, apartmentId: `ap-${input.apt}`, active: true };
      map.set(input.id, resident);
      return resident;
    },
    deactivate: async (id) => {
      const r = map.get(id);
      if (r) map.set(id, { ...r, active: false });
    },
  };
}

const build = (over: Partial<Resident>): Resident => ({
  id: 'x',
  name: 'Nome',
  apt: 'Apto 1',
  apartmentId: 'ap-1',
  phone: '',
  email: '',
  status: 'em_dia',
  active: true,
  ...over,
});

describe('listResidents', () => {
  test('returns residents sorted by name', async () => {
    const repo = fakeRepo([
      build({ id: 'b', name: 'Bruno' }),
      build({ id: 'a', name: 'Ana' }),
      build({ id: 'c', name: 'Carla' }),
    ]);
    expect((await listResidents(repo)).map((r) => r.name)).toEqual(['Ana', 'Bruno', 'Carla']);
  });
});
