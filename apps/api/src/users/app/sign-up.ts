import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { EmailSender } from '../../platform/email/email-sender';
import { generateToken, hashToken } from '../../platform/tokens';
import { RESET_PASSWORD_TTL_MS } from '../domain/auth-token';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { emailSchema } from '../domain/email';
import { EmailTakenError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { UserRepository } from '../domain/user-repository';

import { resetPasswordLink, signupAttemptMessage } from './emails';
import { issueConfirmation } from './issue-confirmation';

const signUpSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(8).max(200),
});

export interface SignUpDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  hasher: PasswordHasher;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
}

async function warnOwner(deps: SignUpDeps, owner: { id: string; email: string }): Promise<void> {
  const token = generateToken();
  await deps.tokens.issue({
    userId: owner.id,
    kind: 'reset_password',
    tokenHash: hashToken(token),
    expiresAt: new Date(deps.now().getTime() + RESET_PASSWORD_TTL_MS),
  });
  await deps.email.send(signupAttemptMessage(owner.email, resetPasswordLink(deps.appUrl, token)));
}

export async function signUp(deps: SignUpDeps, input: unknown): Promise<void> {
  const { name, email, password } = signUpSchema.parse(input);
  const passwordHash = await deps.hasher.hash(password);

  const existing = await deps.users.findByEmail(email);
  if (existing) {
    await warnOwner(deps, { id: existing.id, email });
    return;
  }

  const user = {
    id: randomUUID(),
    username: null,
    email,
    name,
    passwordHash,
    role: 'admin' as const,
    residentId: null,
    emailVerifiedAt: null,
  };
  try {
    await deps.users.save(user);
  } catch (error) {
    if (error instanceof EmailTakenError) return;
    throw error;
  }
  await issueConfirmation(deps, { id: user.id, email });
}
