import { generateToken, hashToken } from '../../platform/tokens';
import { inMemoryAuthTokens, inMemoryUsers } from '../../test-support/in-memory-users';
import { InvalidLinkError } from '../domain/errors';
import type { User } from '../domain/user';

import { confirmEmail } from './confirm-email';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const ana: User = {
  id: 'u-ana',
  username: null,
  email: 'ana@x.com',
  name: 'Ana',
  passwordHash: 'hash',
  role: 'admin',
  residentId: null,
  emailVerifiedAt: null,
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
    now: () => NOW,
    afterEmailConfirmed: async (userId: string) => {
      confirmed.push(userId);
    },
  };
  return { users, token, deps, confirmed };
}

describe('confirmEmail', () => {
  test('marks the e-mail verified, returns the user and runs the hook once', async () => {
    const { users, token, deps, confirmed } = await setup();

    const user = await confirmEmail(deps, token);

    expect(user.emailVerifiedAt).toEqual(NOW);
    expect((await users.findById('u-ana'))?.emailVerifiedAt).toEqual(NOW);
    expect(confirmed).toEqual(['u-ana']);
  });

  test('the same token twice is invalid', async () => {
    const { token, deps } = await setup();
    await confirmEmail(deps, token);

    await expect(confirmEmail(deps, token)).rejects.toBeInstanceOf(InvalidLinkError);
  });

  test('an expired token is invalid', async () => {
    const { token, deps, users } = await setup(ana, new Date(NOW.getTime() - 1));

    await expect(confirmEmail(deps, token)).rejects.toBeInstanceOf(InvalidLinkError);
    expect((await users.findById('u-ana'))?.emailVerifiedAt).toBeNull();
  });

  test('an unknown token is invalid', async () => {
    const { deps } = await setup();

    await expect(confirmEmail(deps, 'nope')).rejects.toBeInstanceOf(InvalidLinkError);
  });

  test('a non-string token is invalid', async () => {
    const { deps } = await setup();

    await expect(confirmEmail(deps, undefined)).rejects.toBeInstanceOf(InvalidLinkError);
  });

  test('an already verified e-mail keeps its date and skips the hook', async () => {
    const earlier = new Date('2026-01-01T00:00:00.000Z');
    const { token, deps, confirmed } = await setup({ ...ana, emailVerifiedAt: earlier });

    const user = await confirmEmail(deps, token);

    expect(user.emailVerifiedAt).toEqual(earlier);
    expect(confirmed).toEqual([]);
  });
});
