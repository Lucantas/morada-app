import { ResidentLoginNotFoundError, UserValidationError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

import { resetResidentPassword } from './reset-resident-password';

function fakeRepo(users: User[] = []): UserRepository {
  let list = [...users];
  return {
    findByUsername: async (username) => list.find((u) => u.username === username) ?? null,
    findByResidentId: async (residentId) => list.find((u) => u.residentId === residentId) ?? null,
    existsByUsername: async (username) => list.some((u) => u.username === username),
    existsByResidentId: async (residentId) => list.some((u) => u.residentId === residentId),
    hasAny: async () => list.length > 0,
    save: async (u) => {
      list = [...list.filter((existing) => existing.id !== u.id), u];
      return u;
    },
  };
}

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

describe('resetResidentPassword', () => {
  test('resets the hash for an existing resident login, keeping identity fields', async () => {
    const repo = fakeRepo([
      {
        id: 'u-1',
        username: 'maria302',
        passwordHash: 'hash:old-secret',
        role: 'resident',
        residentId: 'r-1',
      },
    ]);

    const user = await resetResidentPassword(repo, hasher, 'r-1', 'nova-s3nha');

    expect(user.id).toBe('u-1');
    expect(user.username).toBe('maria302');
    expect(user.residentId).toBe('r-1');
    expect(user.role).toBe('resident');
    expect(user.passwordHash).toBe('hash:nova-s3nha');
    expect(await repo.findByResidentId('r-1')).toEqual(user);
  });

  test('stores the hasher output, never the raw password', async () => {
    const opaqueHasher: PasswordHasher = {
      hash: () => Promise.resolve('opaque-hash'),
      verify: () => Promise.resolve(false),
    };
    const repo = fakeRepo([
      {
        id: 'u-2',
        username: 'joao101',
        passwordHash: 'hash:old',
        role: 'resident',
        residentId: 'r-2',
      },
    ]);

    const user = await resetResidentPassword(repo, opaqueHasher, 'r-2', 'plaintext-secret');

    expect(user.passwordHash).toBe('opaque-hash');
    expect(user.passwordHash).not.toContain('plaintext-secret');
  });

  test('throws ResidentLoginNotFoundError when the resident has no login', async () => {
    await expect(
      resetResidentPassword(fakeRepo(), hasher, 'r-nope', 'nova-s3nha'),
    ).rejects.toBeInstanceOf(ResidentLoginNotFoundError);
  });

  test('throws UserValidationError when the new password is too short', async () => {
    const repo = fakeRepo([
      {
        id: 'u-3',
        username: 'ana303',
        passwordHash: 'hash:old',
        role: 'resident',
        residentId: 'r-3',
      },
    ]);

    await expect(resetResidentPassword(repo, hasher, 'r-3', 'short')).rejects.toBeInstanceOf(
      UserValidationError,
    );
  });
});
