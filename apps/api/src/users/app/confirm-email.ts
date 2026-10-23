import { z } from 'zod';

import { hashToken } from '../../platform/tokens';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { InvalidLinkError } from '../domain/errors';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

const tokenSchema = z.string().min(1).max(200);

export interface ConfirmEmailDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  now: () => Date;
  afterEmailConfirmed: (userId: string) => Promise<void>;
}

export async function confirmEmail(deps: ConfirmEmailDeps, rawToken: unknown): Promise<User> {
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) throw new InvalidLinkError();

  const now = deps.now();
  const consumed = await deps.tokens.consume(hashToken(parsed.data), 'confirm_email', now);
  if (!consumed) throw new InvalidLinkError();

  const user = await deps.users.findById(consumed.userId);
  if (!user) throw new InvalidLinkError();
  if (user.emailVerifiedAt !== null) return user;

  await deps.users.markEmailVerified(user.id, now);
  await deps.afterEmailConfirmed(user.id);
  return { ...user, emailVerifiedAt: now };
}
