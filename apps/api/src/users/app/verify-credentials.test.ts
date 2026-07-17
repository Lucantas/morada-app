import { InvalidCredentialsError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

import { verifyCredentials } from './verify-credentials';

function fakeRepo(users: User[] = []): UserRepository {
  const map = new Map(users.map((u) => [u.username, u]));
  return {
    findByUsername: async (username) => map.get(username) ?? null,
    findByResidentId: async (residentId) =>
      [...map.values()].find((u) => u.residentId === residentId) ?? null,
    existsByUsername: async (username) => map.has(username),
    existsByResidentId: async (residentId) =>
      [...map.values()].some((u) => u.residentId === residentId),
    save: async (u) => {
      map.set(u.username, u);
      return u;
    },
  };
}

const acceptHasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

const maria: User = {
  id: 'u-1',
  username: 'maria302',
  passwordHash: 'hash:s3nha',
  role: 'resident',
  residentId: 'r-1',
};

describe('verifyCredentials', () => {
  test('returns the user when username and password match', async () => {
    const user = await verifyCredentials(fakeRepo([maria]), acceptHasher, 'maria302', 's3nha');
    expect(user).toEqual(maria);
  });

  test('throws InvalidCredentialsError when the username is unknown', async () => {
    await expect(
      verifyCredentials(fakeRepo([maria]), acceptHasher, 'ghost', 's3nha'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  test('throws InvalidCredentialsError when the password does not match', async () => {
    await expect(
      verifyCredentials(fakeRepo([maria]), acceptHasher, 'maria302', 'wrong'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  test('still runs a hash comparison for an unknown username (no timing oracle)', async () => {
    const verified: string[] = [];
    const spyHasher: PasswordHasher = {
      hash: (plain) => Promise.resolve(`hash:${plain}`),
      verify: (_plain, hash) => {
        verified.push(hash);
        return Promise.resolve(false);
      },
    };
    await expect(
      verifyCredentials(fakeRepo([maria]), spyHasher, 'ghost', 's3nha'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(verified).toHaveLength(1);
  });
});
