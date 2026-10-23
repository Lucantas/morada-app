import type { EmailSender } from '../../platform/email/email-sender';
import type { AuthTokenRepository } from '../domain/auth-token-repository';
import { isEmailVerified } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

import { issueConfirmation } from './issue-confirmation';

export interface ResendConfirmationDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
}

export async function resendConfirmation(
  deps: ResendConfirmationDeps,
  userId: string,
): Promise<void> {
  const user = await deps.users.findById(userId);
  if (!user || user.email === null || isEmailVerified(user)) return;

  await deps.tokens.revokeAll(user.id, 'confirm_email', deps.now());
  await issueConfirmation(deps, { id: user.id, email: user.email });
}
