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
  test('save then findByUsername round-trips through SQLite', async () => {
    const repo = new SqliteUserRepository(createTestDb());
    await repo.save(maria);
    expect(await repo.findByUsername('maria302')).toEqual(maria);
  });

  test('findByUsername returns null when missing', async () => {
    expect(await new SqliteUserRepository(createTestDb()).findByUsername('ghost')).toBeNull();
  });

  test('existsByUsername reflects saved users', async () => {
    const repo = new SqliteUserRepository(createTestDb());
    expect(await repo.existsByUsername('maria302')).toBe(false);
    await repo.save(maria);
    expect(await repo.existsByUsername('maria302')).toBe(true);
  });

  test('existsByResidentId reflects the linked resident', async () => {
    const repo = new SqliteUserRepository(createTestDb());
    expect(await repo.existsByResidentId('r-1')).toBe(false);
    await repo.save(maria);
    expect(await repo.existsByResidentId('r-1')).toBe(true);
    expect(await repo.existsByResidentId('r-2')).toBe(false);
  });

  test('rejects a second login for the same resident (unique index)', async () => {
    const repo = new SqliteUserRepository(createTestDb());
    await repo.save(maria);
    await expect(
      repo.save({
        id: 'u-2',
        username: 'maria302-alt',
        passwordHash: 'hash-c',
        role: 'resident',
        residentId: 'r-1',
      }),
    ).rejects.toThrow();
  });

  test('save persists an admin with a null residentId', async () => {
    const repo = new SqliteUserRepository(createTestDb());
    const admin: User = {
      id: 'u-admin',
      username: 'admin',
      passwordHash: 'hash-b',
      role: 'admin',
      residentId: null,
    };
    await repo.save(admin);
    expect(await repo.findByUsername('admin')).toEqual(admin);
  });

  test('save upserts on conflicting id (password rotation)', async () => {
    const repo = new SqliteUserRepository(createTestDb());
    await repo.save(maria);
    await repo.save({ ...maria, passwordHash: 'hash-rotated' });
    expect((await repo.findByUsername('maria302'))?.passwordHash).toBe('hash-rotated');
  });
});
