import { z } from 'zod';

import { hashToken } from '../../platform/tokens';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { InvalidLinkError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import { isEmailVerified, type User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

const passwordSchema = z.string().min(8).max(200);

export interface ResetPasswordDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  hasher: PasswordHasher;
  now: () => Date;
  afterEmailConfirmed: (userId: string) => Promise<void>;
  onCredentialsReplaced: (userId: string) => Promise<void>;
}

export async function resetPassword(
  deps: ResetPasswordDeps,
  input: { token: string; password: unknown },
): Promise<User> {
  const password = passwordSchema.parse(input.password);
  const now = deps.now();
  const consumed = await deps.tokens.consume(hashToken(input.token), 'reset_password', now);
  if (!consumed) throw new InvalidLinkError();

  const user = await deps.users.findById(consumed.userId);
  if (!user) throw new InvalidLinkError();

  const newlyVerified = !isEmailVerified(user);
  if (newlyVerified) await deps.onCredentialsReplaced(user.id);
  const passwordHash = await deps.hasher.hash(password);
  const sessionVersion = await deps.users.setPasswordHashAndBump(user.id, passwordHash);
  await deps.tokens.revokeAll(user.id, 'reset_password', now);
  if (newlyVerified) await deps.users.markEmailVerified(user.id, now);
  if (newlyVerified) await deps.afterEmailConfirmed(user.id);

  return {
    ...user,
    passwordHash,
    emailVerifiedAt: newlyVerified ? now : user.emailVerifiedAt,
    sessionVersion,
  };
}
