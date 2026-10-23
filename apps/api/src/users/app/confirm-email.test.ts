import { generateToken, hashToken } from '../../platform/tokens';
import { inMemoryAuthTokens, inMemoryUsers } from '../../test-support/in-memory-users';
import { InvalidCredentialsError, InvalidLinkError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';

import { confirmEmail } from './confirm-email';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const PASSWORD = 'senha-da-ana-1';

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

const ana: User = {
  id: 'u-ana',
  username: null,
  email: 'ana@x.com',
  name: 'Ana',
  passwordHash: `hash:${PASSWORD}`,
  role: 'admin',
  residentId: null,
  emailVerifiedAt: null,
  sessionVersion: 0,
};

async function setup(user: User = ana, expiresAt = new Date(NOW.getTime() + HOUR)) {
  const users = inMemoryUsers([user]);
  const tokens = inMemoryAuthTokens();
  const token = generateToken();
  await tokens.issue({
    userId: user.id,
    kind: 'confirm_email',
    tokenHash: hashToken(token),
    expiresAt,
  });
  const confirmed: string[] = [];
  const deps = {
    users,
    tokens,
    hasher,
    now: () => NOW,
    afterEmailConfirmed: async (userId: string) => {
      confirmed.push(userId);
    },
  };
  return { users, tokens, token, deps, confirmed };
}

describe('confirmEmail', () => {
  test('marks the e-mail verified, bumps the session and runs the hook once', async () => {
    const { users, token, deps, confirmed } = await setup();

    const user = await confirmEmail(deps, { token, password: PASSWORD });

    expect(user.emailVerifiedAt).toEqual(NOW);
    expect(user.sessionVersion).toBe(1);
    expect(await users.findById('u-ana')).toEqual(user);
    expect(confirmed).toEqual(['u-ana']);
  });

  test('a wrong password is rejected and leaves the token usable', async () => {
    const { users, token, deps, confirmed } = await setup();

    await expect(
      confirmEmail(deps, { token, password: 'senha-do-intruso' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(await users.findById('u-ana')).toEqual(ana);
    expect(confirmed).toEqual([]);
    expect((await confirmEmail(deps, { token, password: PASSWORD })).emailVerifiedAt).toEqual(NOW);
  });

  test('the same token twice is invalid', async () => {
    const { token, deps } = await setup();
    await confirmEmail(deps, { token, password: PASSWORD });

    await expect(confirmEmail(deps, { token, password: PASSWORD })).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });

  test('an expired token is invalid', async () => {
    const { token, deps, users } = await setup(ana, new Date(NOW.getTime() - 1));

    await expect(confirmEmail(deps, { token, password: PASSWORD })).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
    expect((await users.findById('u-ana'))?.emailVerifiedAt).toBeNull();
  });

  test('an unknown token is invalid', async () => {
    const { deps } = await setup();

    await expect(confirmEmail(deps, { token: 'nope', password: PASSWORD })).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });

  test('a token whose user is gone is invalid', async () => {
    const { tokens, deps } = await setup();
    const token = generateToken();
    await tokens.issue({
      userId: 'u-ghost',
      kind: 'confirm_email',
      tokenHash: hashToken(token),
      expiresAt: new Date(NOW.getTime() + HOUR),
    });

    await expect(confirmEmail(deps, { token, password: PASSWORD })).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });

  test('a token consumed between the check and the use is invalid', async () => {
    const { tokens, token, deps } = await setup();
    const racing = {
      ...deps,
      tokens: { ...tokens, consume: async () => null },
    };

    await expect(confirmEmail(racing, { token, password: PASSWORD })).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });

  test('ends old sessions before marking the e-mail verified', async () => {
    const { users, token, deps } = await setup();
    const failing = {
      ...deps,
      users: {
        ...users,
        markEmailVerified: async () => {
          throw new Error('db down');
        },
      },
    };

    await expect(confirmEmail(failing, { token, password: PASSWORD })).rejects.toThrow('db down');

    expect((await users.findById('u-ana'))?.sessionVersion).toBe(1);
  });

  test('an already verified e-mail keeps its date and skips the hook', async () => {
    const earlier = new Date('2026-01-01T00:00:00.000Z');
    const { token, deps, confirmed } = await setup({ ...ana, emailVerifiedAt: earlier });

    const user = await confirmEmail(deps, { token, password: PASSWORD });

    expect(user.emailVerifiedAt).toEqual(earlier);
    expect(user.sessionVersion).toBe(0);
    expect(confirmed).toEqual([]);
  });
});
