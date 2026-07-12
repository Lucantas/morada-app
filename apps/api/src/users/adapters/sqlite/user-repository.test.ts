import { createTestDb } from '../../../platform/db';
import type { User } from '../../domain/user';

import { SqliteUserRepository } from './user-repository';

const maria: User = {
  id: 'u-1',
  username: 'maria302',
  passwordHash: 'hash-a',
  role: 'resident',
  residentId: 'r-1',
};

describe('SqliteUserRepository', () => {
  test('save then findByUsername round-trips through SQLite', () => {
    const repo = new SqliteUserRepository(createTestDb());
    repo.save(maria);
    expect(repo.findByUsername('maria302')).toEqual(maria);
  });

  test('findByUsername returns null when missing', () => {
    expect(new SqliteUserRepository(createTestDb()).findByUsername('ghost')).toBeNull();
  });

  test('existsByUsername reflects saved users', () => {
    const repo = new SqliteUserRepository(createTestDb());
    expect(repo.existsByUsername('maria302')).toBe(false);
    repo.save(maria);
    expect(repo.existsByUsername('maria302')).toBe(true);
  });

  test('save persists an admin with a null residentId', () => {
    const repo = new SqliteUserRepository(createTestDb());
    const admin: User = {
      id: 'u-admin',
      username: 'admin',
      passwordHash: 'hash-b',
      role: 'admin',
      residentId: null,
    };
    repo.save(admin);
    expect(repo.findByUsername('admin')).toEqual(admin);
  });

  test('save upserts on conflicting id (password rotation)', () => {
    const repo = new SqliteUserRepository(createTestDb());
    repo.save(maria);
    repo.save({ ...maria, passwordHash: 'hash-rotated' });
    expect(repo.findByUsername('maria302')?.passwordHash).toBe('hash-rotated');
  });
});
