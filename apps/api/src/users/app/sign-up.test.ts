import { InMemoryEmailSender } from '../../platform/email/in-memory-email-sender';
import { hashToken } from '../../platform/tokens';
import { inMemoryAuthTokens, inMemoryUsers } from '../../test-support/in-memory-users';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';

import { signUp } from './sign-up';

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

const NOW = new Date('2026-10-23T12:00:00.000Z');
const APP_URL = 'https://app.test';

const existing: User = {
  id: 'u-ana',
  username: null,
  email: 'ana@x.com',
  name: 'Ana',
  passwordHash: 'hash:old',
  role: 'admin',
  residentId: null,
  emailVerifiedAt: NOW,
  sessionVersion: 0,
};

function setup(initial: User[] = []) {
  const users = inMemoryUsers(initial);
  const tokens = inMemoryAuthTokens();
  const email = new InMemoryEmailSender();
  const released: string[] = [];
  const deps = {
    users,
    tokens,
    hasher,
    email,
    appUrl: APP_URL,
    now: () => NOW,
    onCredentialsReplaced: async (userId: string) => {
      released.push(`${userId}:${(await users.findById(userId))?.passwordHash ?? ''}`);
    },
  };
  return { users, tokens, email, deps, released };
}

function tokenFrom(text: string, route: string): string {
  const match = new RegExp(`/#/${route}/([\\w-]+)`).exec(text);
  return match?.[1] ?? '';
}

describe('signUp', () => {
  test('creates an unconfirmed admin user and sends a confirmation link', async () => {
    const { users, email, tokens, deps } = setup();

    await signUp(deps, { name: ' Ana ', email: ' Ana@X.com ', password: 'senha-segura-1' });

    const [created] = users.all();
    expect(created).toMatchObject({
      username: null,
      email: 'ana@x.com',
      name: 'Ana',
      role: 'admin',
      residentId: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
      passwordHash: 'hash:senha-segura-1',
    });
    const message = email.lastTo('ana@x.com');
    expect(message?.subject).toBe('Confirme seu e-mail no Morada');
    const token = tokenFrom(message?.text ?? '', 'confirmar-email');
    expect(await tokens.consume(hashToken(token), 'confirm_email', NOW)).toEqual({
      userId: created?.id,
    });
  });

  test('confirmation tokens expire after 24 hours', async () => {
    const { email, tokens, deps } = setup();
    await signUp(deps, { name: 'Ana', email: 'ana@x.com', password: 'senha-segura-1' });
    const token = tokenFrom(email.lastTo('ana@x.com')?.text ?? '', 'confirmar-email');

    const justAfter = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);

    expect(await tokens.consume(hashToken(token), 'confirm_email', justAfter)).toBeNull();
  });

  test('a taken e-mail creates nothing and warns the owner with a reset link', async () => {
    const { users, email, tokens, deps } = setup([existing]);

    await signUp(deps, { name: 'Intruso', email: 'ANA@x.com', password: 'outra-senha-1' });

    expect(users.all()).toEqual([existing]);
    expect(email.sent).toHaveLength(1);
    const message = email.lastTo('ana@x.com');
    expect(message?.subject).not.toBe('Confirme seu e-mail no Morada');
    const token = tokenFrom(message?.text ?? '', 'redefinir-senha');
    expect(await tokens.consume(hashToken(token), 'reset_password', NOW)).toEqual({
      userId: 'u-ana',
    });
  });

  test('a taken e-mail revokes the previous reset link before issuing a new one', async () => {
    const { email, tokens, deps } = setup([existing]);
    await signUp(deps, { name: 'Intruso', email: 'ana@x.com', password: 'outra-senha-1' });
    const first = tokenFrom(email.lastTo('ana@x.com')?.text ?? '', 'redefinir-senha');

    await signUp(deps, { name: 'Intruso', email: 'ana@x.com', password: 'outra-senha-1' });
    const second = tokenFrom(email.lastTo('ana@x.com')?.text ?? '', 'redefinir-senha');

    expect(await tokens.consume(hashToken(first), 'reset_password', NOW)).toBeNull();
    expect(await tokens.consume(hashToken(second), 'reset_password', NOW)).not.toBeNull();
  });

  test('an unverified e-mail takes the new credentials, ends sessions and gets a fresh link', async () => {
    const unverified: User = { ...existing, emailVerifiedAt: null, sessionVersion: 4 };
    const { users, email, tokens, deps, released } = setup([unverified]);
    const atomic = jest.spyOn(users, 'updateCredentialsAndBump');
    await tokens.issue({
      userId: 'u-ana',
      kind: 'confirm_email',
      tokenHash: hashToken('old-link'),
      expiresAt: new Date(NOW.getTime() + 60_000),
    });

    await signUp(deps, { name: 'Ana Real', email: 'ana@x.com', password: 'senha-nova-1' });

    expect(users.all()).toEqual([
      {
        ...unverified,
        name: 'Ana Real',
        passwordHash: 'hash:senha-nova-1',
        sessionVersion: 5,
      },
    ]);
    expect(atomic).toHaveBeenCalledTimes(1);
    expect(released).toEqual([`u-ana:${unverified.passwordHash}`]);
    expect(atomic).toHaveBeenCalledWith('u-ana', {
      name: 'Ana Real',
      passwordHash: 'hash:senha-nova-1',
    });
    expect(await tokens.consume(hashToken('old-link'), 'confirm_email', NOW)).toBeNull();
    const message = email.lastTo('ana@x.com');
    expect(message?.subject).toBe('Confirme seu e-mail no Morada');
    const token = tokenFrom(message?.text ?? '', 'confirmar-email');
    expect(await tokens.consume(hashToken(token), 'confirm_email', NOW)).toEqual({
      userId: 'u-ana',
    });
  });

  test.each([
    { name: '', email: 'a@x.com', password: 'senha-segura-1' },
    { name: 'Ana', email: 'not-an-email', password: 'senha-segura-1' },
    { name: 'Ana', email: 'a@x.com', password: 'curta' },
  ])('rejects invalid input %#', async (input) => {
    const { users, email, deps } = setup();

    await expect(signUp(deps, input)).rejects.toThrow();

    expect(users.all()).toEqual([]);
    expect(email.sent).toEqual([]);
  });
});
