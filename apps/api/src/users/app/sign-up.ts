import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { EmailSender } from '../../platform/email/email-sender';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { emailSchema } from '../domain/email';
import { EmailTakenError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { UserRepository } from '../domain/user-repository';

import { signupAttemptMessage } from './emails';
import { issueConfirmation } from './issue-confirmation';
import { issuePasswordReset } from './issue-password-reset';

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
  const link = await issuePasswordReset(deps, owner.id);
  await deps.email.send(signupAttemptMessage(owner.email, link));
}

async function takeOverUnverified(
  deps: SignUpDeps,
  owner: { id: string; email: string },
  credentials: { name: string; passwordHash: string },
): Promise<void> {
  await deps.users.updateCredentialsAndBump(owner.id, credentials);
  await deps.tokens.revokeAll(owner.id, 'confirm_email', deps.now());
  await issueConfirmation(deps, owner);
}

export async function signUp(deps: SignUpDeps, input: unknown): Promise<void> {
  const { name, email, password } = signUpSchema.parse(input);
  const passwordHash = await deps.hasher.hash(password);

  const existing = await deps.users.findByEmail(email);
  if (existing?.emailVerifiedAt === null) {
    await takeOverUnverified(deps, { id: existing.id, email }, { name, passwordHash });
    return;
  }
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
    sessionVersion: 0,
  };
  try {
    await deps.users.save(user);
  } catch (error) {
    if (error instanceof EmailTakenError) return;
    throw error;
  }
  await issueConfirmation(deps, { id: user.id, email });
}
