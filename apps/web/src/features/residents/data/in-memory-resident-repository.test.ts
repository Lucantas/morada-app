import { buildResident } from '@/test/factories';

import { InMemoryResidentRepository } from './in-memory-resident-repository';

describe('InMemoryResidentRepository', () => {
  test('lists seeded residents', async () => {
    const repo = new InMemoryResidentRepository([
      buildResident({ id: 'a' }),
      buildResident({ id: 'b' }),
    ]);

    expect((await repo.list()).map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  test('save upserts and getById returns it', async () => {
    const repo = new InMemoryResidentRepository([]);
    const resident = buildResident({ id: 'x', name: 'Novo' });

    await repo.save(resident);

    expect(await repo.getById('x')).toEqual(resident);
  });

  test('save does not mutate the previously returned list (immutability)', async () => {
    const repo = new InMemoryResidentRepository([buildResident({ id: 'a' })]);
    const before = await repo.list();

    await repo.save(buildResident({ id: 'b' }));

    expect(before).toHaveLength(1);
  });

  test('listByApartment returns every occupant of the apartment', async () => {
    const repo = new InMemoryResidentRepository([
      buildResident({ id: 'a', apartmentId: 'apt-1', active: true }),
      buildResident({ id: 'b', apartmentId: 'apt-1', active: false }),
      buildResident({ id: 'c', apartmentId: 'apt-2', active: true }),
    ]);

    expect((await repo.listByApartment('apt-1')).map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  test('rejects malformed seed data at the boundary', () => {
    expect(() => new InMemoryResidentRepository([{ id: 'a', name: 'X' }])).toThrow();
  });
});
