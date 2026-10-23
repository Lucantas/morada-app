import { inMemoryUsers } from '../../test-support/in-memory-users';
import { ResidentLoginNotFoundError, UserValidationError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

import { resetResidentPassword } from './reset-resident-password';

function fakeRepo(users: User[] = []): UserRepository {
  return inMemoryUsers(users);
}

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

describe('resetResidentPassword', () => {
  test('replaces the hash and ends sessions in a single atomic call', async () => {
    const repo = fakeRepo([
      {
        id: 'u-1',
        username: 'maria302',
        passwordHash: 'hash:old-secret',
        role: 'resident',
        residentId: 'r-1',
        email: null,
        name: null,
        emailVerifiedAt: null,
        sessionVersion: 6,
      },
    ]);
    const atomic = jest.spyOn(repo, 'setPasswordHashAndBump');

    const user = await resetResidentPassword(repo, hasher, 'r-1', 'nova-s3nha');

    expect(atomic).toHaveBeenCalledTimes(1);
    expect(atomic).toHaveBeenCalledWith('u-1', 'hash:nova-s3nha');
    expect(user.sessionVersion).toBe(7);
    expect(await repo.findById('u-1')).toEqual(user);
  });

  test('resets the hash for an existing resident login, keeping identity fields', async () => {
    const repo = fakeRepo([
      {
        id: 'u-1',
        username: 'maria302',
        passwordHash: 'hash:old-secret',
        role: 'resident',
        residentId: 'r-1',
        email: null,
        name: null,
        emailVerifiedAt: null,
        sessionVersion: 0,
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
        email: null,
        name: null,
        emailVerifiedAt: null,
        sessionVersion: 0,
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
        email: null,
        name: null,
        emailVerifiedAt: null,
        sessionVersion: 0,
      },
    ]);

    await expect(resetResidentPassword(repo, hasher, 'r-3', 'short')).rejects.toBeInstanceOf(
      UserValidationError,
    );
  });
});
