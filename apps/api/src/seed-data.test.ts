import type { PasswordHasher } from './users/domain/password-hasher';
import type { User } from './users/domain/user';
import type { UserRepository } from './users/domain/user-repository';

import { adminCredentials, seedAdmin } from './seed-data';

jest.mock('./platform/config', () => ({
  config: { isProduction: false },
}));

import { config } from './platform/config';

function fakeRepo(users: User[] = []): UserRepository {
  const map = new Map(users.map((u) => [u.username, u]));
  return {
    findByUsername: async (username) => map.get(username) ?? null,
    findByResidentId: async (residentId) =>
      [...map.values()].find((u) => u.residentId === residentId) ?? null,
    existsByUsername: async (username) => map.has(username),
    existsByResidentId: async (residentId) =>
      [...map.values()].some((u) => u.residentId === residentId),
    hasAny: async () => map.size > 0,
    save: async (u) => {
      map.set(u.username, u);
      return u;
    },
  };
}

const noopHasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

const existingResident: User = {
  id: 'u-1',
  username: 'maria302',
  passwordHash: 'existing-hash',
  role: 'resident',
  residentId: 'r-1',
};

describe('seedAdmin', () => {
  afterEach(() => {
    (config as { isProduction: boolean }).isProduction = false;
  });

  test('seeds the admin when no user exists yet (non-production)', async () => {
    const repo = fakeRepo([]);
    await seedAdmin(repo, noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).not.toBeNull();
  });

  test('is a no-op when the admin already exists (non-production)', async () => {
    const existingAdmin: User = {
      id: 'u-admin',
      username: adminCredentials.username,
      passwordHash: 'existing-hash',
      role: 'admin',
      residentId: null,
    };
    const repo = fakeRepo([existingAdmin]);
    await seedAdmin(repo, noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).toEqual(existingAdmin);
  });

  test('seeds the admin alongside other users when not in production', async () => {
    const repo = fakeRepo([existingResident]);
    await seedAdmin(repo, noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).not.toBeNull();
  });

  test('seeds normally in production when the database is empty', async () => {
    (config as { isProduction: boolean }).isProduction = true;
    const repo = fakeRepo([]);
    await seedAdmin(repo, noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).not.toBeNull();
  });

  test('is a no-op in production when the admin already exists', async () => {
    (config as { isProduction: boolean }).isProduction = true;
    const existingAdmin: User = {
      id: 'u-admin',
      username: adminCredentials.username,
      passwordHash: 'existing-hash',
      role: 'admin',
      residentId: null,
    };
    const repo = fakeRepo([existingAdmin]);
    await seedAdmin(repo, noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).toEqual(existingAdmin);
  });

  test('throws in production when other users exist but not the admin, and does not save', async () => {
    (config as { isProduction: boolean }).isProduction = true;
    const saveSpy = jest.fn(async (u: User) => u);
    const repo: UserRepository = {
      findByUsername: async (username) =>
        username === existingResident.username ? existingResident : null,
      findByResidentId: async (residentId) =>
        residentId === existingResident.residentId ? existingResident : null,
      existsByUsername: async (username) => username === existingResident.username,
      existsByResidentId: async (residentId) => residentId === existingResident.residentId,
      hasAny: async () => true,
      save: saveSpy,
    };

    await expect(seedAdmin(repo, noopHasher)).rejects.toThrow(
      'Refusing to seed demo admin into a populated production database',
    );
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
