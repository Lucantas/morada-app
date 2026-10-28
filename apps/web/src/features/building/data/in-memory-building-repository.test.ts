import { InMemoryBuildingRepository } from './in-memory-building-repository';

describe('InMemoryBuildingRepository', () => {
  test('adds an apartment on its floor and block', async () => {
    const repository = new InMemoryBuildingRepository();

    await repository.addApartment({ label: 'Apto 101', block: null, floor: 1 });
    const building = await repository.get();

    expect(building.blocks[0]?.floors[0]?.apartments[0]?.label).toBe('Apto 101');
  });

  test('places an apartment without a floor among the unplaced', async () => {
    const repository = new InMemoryBuildingRepository();

    await repository.addApartment({ label: 'Loja', block: null, floor: null });

    expect((await repository.get()).unplaced.map((a) => a.label)).toEqual(['Loja']);
  });

  test('rejects a duplicate label', async () => {
    const repository = new InMemoryBuildingRepository();
    await repository.addApartment({ label: 'Apto 101', block: null, floor: 1 });

    await expect(
      repository.addApartment({ label: 'Apto 101', block: null, floor: 2 }),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  test('renames and deactivates an apartment', async () => {
    const repository = new InMemoryBuildingRepository();
    await repository.addApartment({ label: 'Apto 101', block: null, floor: 1 });
    const id = (await repository.get()).blocks[0]?.floors[0]?.apartments[0]?.id ?? '';

    await repository.renameApartment(id, 'Apto 102');
    const renamed = (await repository.get()).blocks[0]?.floors[0]?.apartments[0]?.label;
    await repository.deactivateApartment(id);

    expect(renamed).toBe('Apto 102');
    expect((await repository.get()).blocks).toEqual([]);
  });

  test('reports an unknown apartment as not found', async () => {
    const repository = new InMemoryBuildingRepository();

    await expect(repository.renameApartment('x', 'A')).rejects.toMatchObject({
      kind: 'not_found',
    });
    await expect(repository.deactivateApartment('x')).rejects.toMatchObject({
      kind: 'not_found',
    });
  });
});
