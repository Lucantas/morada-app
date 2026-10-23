import { InMemoryEmailSender } from '../../platform/email/in-memory-email-sender';
import { hashToken } from '../../platform/tokens';
import { inMemoryAuthTokens, inMemoryUsers } from '../../test-support/in-memory-users';
import type { User } from '../domain/user';

import { resendConfirmation } from './resend-confirmation';

const NOW = new Date('2026-10-23T12:00:00.000Z');

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

function setup(user: User = ana) {
  const users = inMemoryUsers([user]);
  const tokens = inMemoryAuthTokens();
  const email = new InMemoryEmailSender();
  return {
    tokens,
    email,
    deps: { users, tokens, email, appUrl: 'https://app.test', now: () => NOW },
  };
}

function tokenOf(text: string | undefined): string {
  return /confirmar-email\/([\w-]+)/.exec(text ?? '')?.[1] ?? '';
}

describe('resendConfirmation', () => {
  test('sends a fresh link and revokes the previous one', async () => {
    const { tokens, email, deps } = setup();

    await resendConfirmation(deps, 'u-ana');
    const first = tokenOf(email.lastTo('ana@x.com')?.text);
    await resendConfirmation(deps, 'u-ana');
    const second = tokenOf(email.lastTo('ana@x.com')?.text);

    expect(first).not.toBe(second);
    expect(await tokens.consume(hashToken(first), 'confirm_email', NOW)).toBeNull();
    expect(await tokens.consume(hashToken(second), 'confirm_email', NOW)).toEqual({
      userId: 'u-ana',
    });
  });

  test('is a no-op when the e-mail is already confirmed', async () => {
    const { email, deps } = setup({ ...ana, emailVerifiedAt: NOW });

    await resendConfirmation(deps, 'u-ana');

    expect(email.sent).toEqual([]);
  });

  test('is a no-op for an unknown user', async () => {
    const { email, deps } = setup();

    await resendConfirmation(deps, 'u-ghost');

    expect(email.sent).toEqual([]);
  });
});
