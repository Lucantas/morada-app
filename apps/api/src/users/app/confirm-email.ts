import { hashToken } from '../../platform/tokens';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { InvalidCredentialsError, InvalidLinkError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

export interface ConfirmEmailDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  hasher: PasswordHasher;
  now: () => Date;
  afterEmailConfirmed: (userId: string) => Promise<void>;
}

export async function confirmEmail(
  deps: ConfirmEmailDeps,
  input: { token: string; password: string },
): Promise<User> {
  const now = deps.now();
  const tokenHash = hashToken(input.token);
  const pending = await deps.tokens.peek(tokenHash, 'confirm_email', now);
  if (!pending) throw new InvalidLinkError();

  const user = await deps.users.findById(pending.userId);
  if (!user) throw new InvalidLinkError();
  if (!(await deps.hasher.verify(input.password, user.passwordHash))) {
    throw new InvalidCredentialsError();
  }

  const consumed = await deps.tokens.consume(tokenHash, 'confirm_email', now);
  if (consumed?.userId !== user.id) throw new InvalidLinkError();
  if (user.emailVerifiedAt !== null) return user;

  const sessionVersion = await deps.users.bumpSessionVersion(user.id);
  await deps.users.markEmailVerified(user.id, now);
  await deps.afterEmailConfirmed(user.id);
  return { ...user, emailVerifiedAt: now, sessionVersion };
}
