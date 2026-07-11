import { createTestDb } from '../../../platform/db';

import { SqliteResidentRepository } from './resident-repository';

describe('SqliteResidentRepository', () => {
  test('save then getById round-trips through SQLite', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    const resident = {
      id: 'r-1',
      name: 'Ana',
      apt: 'Apto 1',
      phone: '9',
      email: 'a@b.c',
      status: 'em_dia' as const,
    };

    repo.save(resident);

    expect(repo.getById('r-1')).toEqual(resident);
  });

  test('save upserts on conflicting id', () => {
    const repo = new SqliteResidentRepository(createTestDb());
    repo.save({ id: 'r-1', name: 'Ana', apt: 'Apto 1', phone: '', email: '', status: 'em_dia' });
    repo.save({
      id: 'r-1',
      name: 'Ana Paula',
      apt: 'Apto 1',
      phone: '',
      email: '',
      status: 'pendente',
    });

    expect(repo.list()).toHaveLength(1);
    expect(repo.getById('r-1')?.name).toBe('Ana Paula');
  });

  test('getById returns null when missing', () => {
    expect(new SqliteResidentRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
