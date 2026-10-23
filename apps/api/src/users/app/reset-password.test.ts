import { generateToken, hashToken } from '../../platform/tokens';
import { inMemoryAuthTokens, inMemoryUsers } from '../../test-support/in-memory-users';
import { InvalidLinkError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';

import { resetPassword } from './reset-password';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

const ana: User = {
  id: 'u-ana',
  username: null,
  email: 'ana@x.com',
  name: 'Ana',
  passwordHash: 'hash:old',
  role: 'admin',
  residentId: null,
  emailVerifiedAt: null,
  sessionVersion: 2,
};

async function issue(
  tokens: ReturnType<typeof inMemoryAuthTokens>,
  expiresAt = new Date(NOW.getTime() + HOUR),
): Promise<string> {
  const token = generateToken();
  await tokens.issue({
    userId: 'u-ana',
    kind: 'reset_password',
    tokenHash: hashToken(token),
    expiresAt,
  });
  return token;
}

function setup(user: User = ana) {
  const users = inMemoryUsers([user]);
  const tokens = inMemoryAuthTokens();
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
  return { users, tokens, deps, confirmed };
}

describe('resetPassword', () => {
  test('sets the new hash, verifies the e-mail, bumps the session and runs the hook', async () => {
    const { users, tokens, deps, confirmed } = setup();
    const token = await issue(tokens);

    const user = await resetPassword(deps, { token, password: 'nova-senha-1' });

    const stored = await users.findById('u-ana');
    expect(stored).toEqual({
      ...ana,
      passwordHash: 'hash:nova-senha-1',
      emailVerifiedAt: NOW,
      sessionVersion: 3,
    });
    expect(user).toEqual(stored);
    expect(confirmed).toEqual(['u-ana']);
  });

  test('an already verified e-mail keeps its date and skips the hook', async () => {
    const earlier = new Date('2026-01-01T00:00:00.000Z');
    const { users, tokens, deps, confirmed } = setup({ ...ana, emailVerifiedAt: earlier });
    const token = await issue(tokens);

    await resetPassword(deps, { token, password: 'nova-senha-1' });

    expect((await users.findById('u-ana'))?.emailVerifiedAt).toEqual(earlier);
    expect(confirmed).toEqual([]);
  });

  test('revokes the other reset links of the user', async () => {
    const { tokens, deps } = setup();
    const used = await issue(tokens);
    const other = await issue(tokens);

    await resetPassword(deps, { token: used, password: 'nova-senha-1' });

    await expect(
      resetPassword(deps, { token: other, password: 'outra-senha-1' }),
    ).rejects.toBeInstanceOf(InvalidLinkError);
  });

  test('a reused token is invalid', async () => {
    const { tokens, deps } = setup();
    const token = await issue(tokens);
    await resetPassword(deps, { token, password: 'nova-senha-1' });

    await expect(resetPassword(deps, { token, password: 'outra-senha-1' })).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });

  test('an expired or unknown token is invalid and changes nothing', async () => {
    const { users, tokens, deps } = setup();
    const expired = await issue(tokens, new Date(NOW.getTime() - 1));

    await expect(
      resetPassword(deps, { token: expired, password: 'nova-senha-1' }),
    ).rejects.toBeInstanceOf(InvalidLinkError);
    await expect(
      resetPassword(deps, { token: 'nope', password: 'nova-senha-1' }),
    ).rejects.toBeInstanceOf(InvalidLinkError);
    expect(await users.findById('u-ana')).toEqual(ana);
  });

  test('a short password is rejected before the token is used', async () => {
    const { tokens, deps } = setup();
    const token = await issue(tokens);

    await expect(resetPassword(deps, { token, password: 'curta' })).rejects.toThrow();

    expect((await resetPassword(deps, { token, password: 'nova-senha-1' })).sessionVersion).toBe(3);
  });

  test('ends old sessions before replacing the password', async () => {
    const { users, tokens, deps } = setup();
    const token = await issue(tokens);
    const failing = {
      ...deps,
      users: {
        ...users,
        setPasswordHash: async () => {
          throw new Error('db down');
        },
      },
    };

    await expect(resetPassword(failing, { token, password: 'nova-senha-1' })).rejects.toThrow(
      'db down',
    );

    expect((await users.findById('u-ana'))?.sessionVersion).toBe(3);
  });

  test('a token whose user is gone is invalid', async () => {
    const { tokens, deps } = setup();
    const token = generateToken();
    await tokens.issue({
      userId: 'u-ghost',
      kind: 'reset_password',
      tokenHash: hashToken(token),
      expiresAt: new Date(NOW.getTime() + HOUR),
    });

    await expect(resetPassword(deps, { token, password: 'nova-senha-1' })).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });
});
