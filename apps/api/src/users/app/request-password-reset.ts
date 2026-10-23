import { z } from 'zod';

import type { EmailSender } from '../../platform/email/email-sender';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { emailSchema } from '../domain/email';
import type { UserRepository } from '../domain/user-repository';

import { resetPasswordMessage } from './emails';
import { issuePasswordReset } from './issue-password-reset';

const requestSchema = z.object({ email: emailSchema });

export interface RequestPasswordResetDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
}

export async function requestPasswordReset(
  deps: RequestPasswordResetDeps,
  input: unknown,
): Promise<void> {
  const { email } = requestSchema.parse(input);
  const user = await deps.users.findByEmail(email);
  if (!user) return;

  const link = await issuePasswordReset(deps, user.id);
  await deps.email.send(resetPasswordMessage(email, link));
}
