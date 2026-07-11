import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { listResidents } from './list-residents';

function fakeRepo(list: Resident[]): ResidentRepository {
  const map = new Map(list.map((r) => [r.id, r]));
  return {
    list: () => [...map.values()],
    getById: (id) => map.get(id) ?? null,
    save: (r) => {
      map.set(r.id, r);
      return r;
    },
  };
}

const build = (over: Partial<Resident>): Resident => ({
  id: 'x',
  name: 'Nome',
  apt: 'Apto 1',
  phone: '',
  email: '',
  status: 'em_dia',
  ...over,
});

describe('listResidents', () => {
  test('returns residents sorted by name', () => {
    const repo = fakeRepo([
      build({ id: 'b', name: 'Bruno' }),
      build({ id: 'a', name: 'Ana' }),
      build({ id: 'c', name: 'Carla' }),
    ]);
    expect(listResidents(repo).map((r) => r.name)).toEqual(['Ana', 'Bruno', 'Carla']);
  });
});
