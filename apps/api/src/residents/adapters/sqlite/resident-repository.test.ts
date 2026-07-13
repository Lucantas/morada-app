import { createTestDb } from '../../../platform/db';
import { ApartmentOccupiedError } from '../../domain/errors';

import { SqliteResidentRepository } from './resident-repository';

const maria = {
  id: 'r-1',
  name: 'Maria Ribeiro',
  apt: 'Apto 302',
  phone: '9',
  email: 'a@b.c',
  status: 'em_dia' as const,
};

describe('SqliteResidentRepository', () => {
  test('save creates the apartment + active occupancy and getById joins them', async () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const saved = await repo.save(maria);

    expect(saved).toMatchObject({
      id: 'r-1',
      name: 'Maria Ribeiro',
      apt: 'Apto 302',
      active: true,
    });
    expect(saved.apartmentId).toMatch(/.+/);
    expect(await repo.getById('r-1')).toEqual(saved);
  });

  test('reuses the apartment for the same label', async () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const first = await repo.save(maria);
    await repo.deactivate('r-1');
    const next = await repo.save({ ...maria, id: 'r-9', name: 'Ana' });
    expect(next.apartmentId).toBe(first.apartmentId);
  });

  test('rejects a second active resident in the same apartment', async () => {
    const repo = new SqliteResidentRepository(createTestDb());
    await repo.save(maria);
    await expect(repo.save({ ...maria, id: 'r-9', name: 'Ana' })).rejects.toThrow(
      ApartmentOccupiedError,
    );
  });

  test('deactivate frees the apartment for the next occupant', async () => {
    const repo = new SqliteResidentRepository(createTestDb());
    await repo.save(maria);
    await repo.deactivate('r-1');
    const ana = await repo.save({ ...maria, id: 'r-9', name: 'Ana' });

    expect(ana.active).toBe(true);
    expect((await repo.getById('r-1'))?.active).toBe(false);
    expect((await repo.list()).map((r) => r.id)).toEqual(['r-9']); // only the active one
  });

  test('listByApartment returns the full history of the apartment', async () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const mamaria = await repo.save(maria);
    await repo.deactivate('r-1');
    await repo.save({ ...maria, id: 'r-9', name: 'Ana' });

    const history = (await repo.listByApartment(mamaria.apartmentId)).map((r) => r.name).sort();
    expect(history).toEqual(['Ana', 'Maria Ribeiro']);
  });

  test('update keeps the id and occupancy, changing person fields', async () => {
    const repo = new SqliteResidentRepository(createTestDb());
    await repo.save(maria);
    const updated = await repo.save({ ...maria, name: 'Maria R.', status: 'pendente' });

    expect(updated).toMatchObject({
      id: 'r-1',
      name: 'Maria R.',
      status: 'pendente',
      active: true,
    });
    expect(await repo.list()).toHaveLength(1);
  });

  test('apartmentOf resolves the resident apartment', async () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const saved = await repo.save(maria);
    expect(await repo.apartmentOf('r-1')).toEqual({
      apartmentId: saved.apartmentId,
      apt: 'Apto 302',
    });
  });

  test('getById returns null when missing', async () => {
    expect(await new SqliteResidentRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
