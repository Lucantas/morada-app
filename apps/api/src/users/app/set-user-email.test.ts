import { inMemoryUsers } from '../../test-support/in-memory-users';
import { EmailTakenError, UnknownUserError, UserValidationError } from '../domain/errors';
import type { User } from '../domain/user';

import { setUserEmail } from './set-user-email';

const legacy: User = {
  id: 'u-1',
  username: 'admin',
  email: null,
  name: null,
  passwordHash: 'hash',
  role: 'admin',
  residentId: null,
  emailVerifiedAt: null,
  sessionVersion: 0,
};

const now = new Date('2026-10-23T12:00:00Z');

describe('setUserEmail', () => {
  test('stores the normalized e-mail and marks it verified', async () => {
    const users = inMemoryUsers([legacy]);

    await setUserEmail(users, 'admin', '  Admin@Example.COM ', () => now);

    expect(await users.findById('u-1')).toEqual({
      ...legacy,
      email: 'admin@example.com',
      emailVerifiedAt: now,
    });
  });

  test('rejects an unknown username', async () => {
    const users = inMemoryUsers([legacy]);

    await expect(setUserEmail(users, 'ghost', 'a@b.com', () => now)).rejects.toBeInstanceOf(
      UnknownUserError,
    );
  });

  test('rejects an e-mail that belongs to another user', async () => {
    const other: User = { ...legacy, id: 'u-2', username: null, email: 'taken@example.com' };
    const users = inMemoryUsers([legacy, other]);

    await expect(
      setUserEmail(users, 'admin', 'Taken@Example.com', () => now),
    ).rejects.toBeInstanceOf(EmailTakenError);
    expect((await users.findById('u-1'))?.email).toBeNull();
  });

  test('rejects a malformed e-mail', async () => {
    const users = inMemoryUsers([legacy]);

    await expect(setUserEmail(users, 'admin', 'not-an-email', () => now)).rejects.toBeInstanceOf(
      UserValidationError,
    );
  });
});
