import {
  ResidentLoginExistsError,
  UnknownResidentError,
  UsernameTakenError,
  UserValidationError,
} from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

import { createResidentLogin } from './create-resident-login';

function fakeRepo(users: User[] = []): UserRepository {
  const list = [...users];
  return {
    findByUsername: async (username) => list.find((u) => u.username === username) ?? null,
    existsByUsername: async (username) => list.some((u) => u.username === username),
    existsByResidentId: async (residentId) => list.some((u) => u.residentId === residentId),
    save: async (u) => {
      list.push(u);
      return u;
    },
  };
}

const anyResident = async () => true;

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

describe('createResidentLogin', () => {
  test('creates a resident user with a hashed password and a generated id', async () => {
    const repo = fakeRepo();
    const user = await createResidentLogin(repo, hasher, anyResident, {
      username: 'maria302',
      password: 's3nha-temp',
      residentId: 'r-1',
    });

    expect(user.username).toBe('maria302');
    expect(user.role).toBe('resident');
    expect(user.residentId).toBe('r-1');
    expect(user.passwordHash).toBe('hash:s3nha-temp');
    expect(user.id).toMatch(/.+/);
    expect(await repo.findByUsername('maria302')).toEqual(user);
  });

  test('stores the hasher output, never the raw password', async () => {
    const opaqueHasher: PasswordHasher = {
      hash: () => Promise.resolve('opaque-hash'),
      verify: () => Promise.resolve(false),
    };
    const user = await createResidentLogin(fakeRepo(), opaqueHasher, anyResident, {
      username: 'joao101',
      password: 'plaintext-secret',
      residentId: 'r-2',
    });
    expect(user.passwordHash).toBe('opaque-hash');
    expect(user.passwordHash).not.toContain('plaintext-secret');
  });

  test('throws UsernameTakenError when the username already exists', async () => {
    const repo = fakeRepo([
      { id: 'u-9', username: 'maria302', passwordHash: 'x', role: 'resident', residentId: 'r-9' },
    ]);
    await expect(
      createResidentLogin(repo, hasher, anyResident, {
        username: 'maria302',
        password: 's3nha-temp',
        residentId: 'r-1',
      }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  test('throws UnknownResidentError when the resident does not exist', async () => {
    await expect(
      createResidentLogin(fakeRepo(), hasher, async () => false, {
        username: 'ghost404',
        password: 's3nha-temp',
        residentId: 'r-nope',
      }),
    ).rejects.toBeInstanceOf(UnknownResidentError);
  });

  test('throws ResidentLoginExistsError when the resident already has a login', async () => {
    const repo = fakeRepo([
      { id: 'u-1', username: 'maria302', passwordHash: 'x', role: 'resident', residentId: 'r-1' },
    ]);
    await expect(
      createResidentLogin(repo, hasher, anyResident, {
        username: 'maria302-2',
        password: 's3nha-temp',
        residentId: 'r-1',
      }),
    ).rejects.toBeInstanceOf(ResidentLoginExistsError);
  });

  test('rejects an invalid username', async () => {
    await expect(
      createResidentLogin(fakeRepo(), hasher, anyResident, {
        username: 'no',
        password: 's3nha-temp',
        residentId: 'r-1',
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
  });

  test('rejects a too-short password', async () => {
    await expect(
      createResidentLogin(fakeRepo(), hasher, anyResident, {
        username: 'maria302',
        password: 'short',
        residentId: 'r-1',
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
  });
});
