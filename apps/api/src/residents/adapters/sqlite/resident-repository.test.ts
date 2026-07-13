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
  test('save creates the apartment + active occupancy and getById joins them', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const saved = repo.save(maria);

    expect(saved).toMatchObject({
      id: 'r-1',
      name: 'Maria Ribeiro',
      apt: 'Apto 302',
      active: true,
    });
    expect(saved.apartmentId).toMatch(/.+/);
    expect(repo.getById('r-1')).toEqual(saved);
  });

  test('reuses the apartment for the same label', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const first = repo.save(maria);
    repo.deactivate('r-1');
    const next = repo.save({ ...maria, id: 'r-9', name: 'Ana' });
    expect(next.apartmentId).toBe(first.apartmentId);
  });

  test('rejects a second active resident in the same apartment', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    repo.save(maria);
    expect(() => repo.save({ ...maria, id: 'r-9', name: 'Ana' })).toThrow(ApartmentOccupiedError);
  });

  test('deactivate frees the apartment for the next occupant', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    repo.save(maria);
    repo.deactivate('r-1');
    const ana = repo.save({ ...maria, id: 'r-9', name: 'Ana' });

    expect(ana.active).toBe(true);
    expect(repo.getById('r-1')?.active).toBe(false);
    expect(repo.list().map((r) => r.id)).toEqual(['r-9']); // only the active one
  });

  test('listByApartment returns the full history of the apartment', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const mamaria = repo.save(maria);
    repo.deactivate('r-1');
    repo.save({ ...maria, id: 'r-9', name: 'Ana' });

    const history = repo
      .listByApartment(mamaria.apartmentId)
      .map((r) => r.name)
      .sort();
    expect(history).toEqual(['Ana', 'Maria Ribeiro']);
  });

  test('update keeps the id and occupancy, changing person fields', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    repo.save(maria);
    const updated = repo.save({ ...maria, name: 'Maria R.', status: 'pendente' });

    expect(updated).toMatchObject({
      id: 'r-1',
      name: 'Maria R.',
      status: 'pendente',
      active: true,
    });
    expect(repo.list()).toHaveLength(1);
  });

  test('apartmentOf resolves the resident apartment', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const saved = repo.save(maria);
    expect(repo.apartmentOf('r-1')).toEqual({ apartmentId: saved.apartmentId, apt: 'Apto 302' });
  });

  test('getById returns null when missing', () => {
    expect(new SqliteResidentRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
