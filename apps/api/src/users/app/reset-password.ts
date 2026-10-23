import { hashToken } from '../../platform/tokens';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { InvalidLinkError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import { isEmailVerified, type User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

export interface ResetPasswordDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  hasher: PasswordHasher;
  now: () => Date;
  afterEmailConfirmed: (userId: string) => Promise<void>;
}

export async function resetPassword(
  deps: ResetPasswordDeps,
  input: { token: string; password: string },
): Promise<User> {
  const now = deps.now();
  const consumed = await deps.tokens.consume(hashToken(input.token), 'reset_password', now);
  if (!consumed) throw new InvalidLinkError();

  const user = await deps.users.findById(consumed.userId);
  if (!user) throw new InvalidLinkError();

  const passwordHash = await deps.hasher.hash(input.password);
  await deps.users.setPasswordHash(user.id, passwordHash);
  await deps.tokens.revokeAll(user.id, 'reset_password', now);
  const newlyVerified = !isEmailVerified(user);
  if (newlyVerified) await deps.users.markEmailVerified(user.id, now);
  const sessionVersion = await deps.users.bumpSessionVersion(user.id);
  if (newlyVerified) await deps.afterEmailConfirmed(user.id);

  return {
    ...user,
    passwordHash,
    emailVerifiedAt: newlyVerified ? now : user.emailVerifiedAt,
    sessionVersion,
  };
}
