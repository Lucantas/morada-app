import { InMemoryEmailSender } from '../../platform/email/in-memory-email-sender';
import { hashToken } from '../../platform/tokens';
import { inMemoryAuthTokens, inMemoryUsers } from '../../test-support/in-memory-users';
import type { User } from '../domain/user';

import { requestPasswordReset } from './request-password-reset';

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
  emailVerifiedAt: NOW,
  sessionVersion: 0,
};

function setup() {
  const tokens = inMemoryAuthTokens();
  const email = new InMemoryEmailSender();
  const deps = {
    users: inMemoryUsers([ana]),
    tokens,
    email,
    appUrl: 'https://app.test',
    now: () => NOW,
  };
  return { tokens, email, deps };
}

function resetTokenIn(text: string | undefined): string {
  return /redefinir-senha\/([\w-]+)/.exec(text ?? '')?.[1] ?? '';
}

describe('requestPasswordReset', () => {
  test('sends nothing for an unknown e-mail', async () => {
    const { email, deps } = setup();

    await requestPasswordReset(deps, { email: 'ghost@x.com' });

    expect(email.sent).toEqual([]);
  });

  test('e-mails a one-hour reset link to a known, normalized e-mail', async () => {
    const { tokens, email, deps } = setup();

    await requestPasswordReset(deps, { email: ' ANA@x.com ' });

    const message = email.lastTo('ana@x.com');
    expect(message?.subject).toBe('Redefinição de senha do Morada');
    const token = resetTokenIn(message?.text);
    expect(token).not.toBe('');
    const late = new Date(NOW.getTime() + HOUR);
    expect(await tokens.consume(hashToken(token), 'reset_password', late)).toBeNull();
    expect(await tokens.consume(hashToken(token), 'reset_password', NOW)).toEqual({
      userId: 'u-ana',
    });
  });

  test('a new request revokes the previous reset link', async () => {
    const { tokens, email, deps } = setup();
    await requestPasswordReset(deps, { email: 'ana@x.com' });
    const first = resetTokenIn(email.lastTo('ana@x.com')?.text);

    await requestPasswordReset(deps, { email: 'ana@x.com' });
    const second = resetTokenIn(email.lastTo('ana@x.com')?.text);

    expect(await tokens.consume(hashToken(first), 'reset_password', NOW)).toBeNull();
    expect(await tokens.consume(hashToken(second), 'reset_password', NOW)).not.toBeNull();
  });

  test('rejects an invalid e-mail', async () => {
    const { email, deps } = setup();

    await expect(requestPasswordReset(deps, { email: 'nope' })).rejects.toThrow();
    expect(email.sent).toEqual([]);
  });
});
