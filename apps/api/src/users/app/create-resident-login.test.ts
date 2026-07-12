import { UsernameTakenError, UserValidationError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

import { createResidentLogin } from './create-resident-login';

function fakeRepo(users: User[] = []): UserRepository {
  const map = new Map(users.map((u) => [u.username, u]));
  return {
    findByUsername: (username) => map.get(username) ?? null,
    existsByUsername: (username) => map.has(username),
    save: (u) => {
      map.set(u.username, u);
      return u;
    },
  };
}

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

describe('createResidentLogin', () => {
  test('creates a resident user with a hashed password and a generated id', async () => {
    const repo = fakeRepo();
    const user = await createResidentLogin(repo, hasher, {
      username: 'maria302',
      password: 's3nha-temp',
      residentId: 'r-1',
    });

    expect(user.username).toBe('maria302');
    expect(user.role).toBe('resident');
    expect(user.residentId).toBe('r-1');
    expect(user.passwordHash).toBe('hash:s3nha-temp');
    expect(user.id).toMatch(/.+/);
    expect(repo.findByUsername('maria302')).toEqual(user);
  });

  test('stores the hasher output, never the raw password', async () => {
    const opaqueHasher: PasswordHasher = {
      hash: () => Promise.resolve('opaque-hash'),
      verify: () => Promise.resolve(false),
    };
    const user = await createResidentLogin(fakeRepo(), opaqueHasher, {
      username: 'joao101',
      password: 'plaintext-secret',
      residentId: 'r-2',
    });
    expect(user.passwordHash).toBe('opaque-hash');
    expect(user.passwordHash).not.toContain('plaintext-secret');
  });

  test('throws UsernameTakenError when the username already exists', async () => {
    const repo = fakeRepo([
      { id: 'u-9', username: 'maria302', passwordHash: 'x', role: 'resident', residentId: 'r-1' },
    ]);
    await expect(
      createResidentLogin(repo, hasher, {
        username: 'maria302',
        password: 's3nha-temp',
        residentId: 'r-1',
      }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  test('rejects an invalid username', async () => {
    await expect(
      createResidentLogin(fakeRepo(), hasher, {
        username: 'no',
        password: 's3nha-temp',
        residentId: 'r-1',
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
  });

  test('rejects a too-short password', async () => {
    await expect(
      createResidentLogin(fakeRepo(), hasher, {
        username: 'maria302',
        password: 'short',
        residentId: 'r-1',
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
  });
});
