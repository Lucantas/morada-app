import { generateToken, hashToken } from '../../platform/tokens';
import type { EmailSender } from '../../platform/email/email-sender';
import { CONFIRM_EMAIL_TTL_MS } from '../domain/auth-token';
import type { AuthTokenRepository } from '../domain/auth-token-repository';

import { confirmEmailLink, confirmEmailMessage } from './emails';

export async function issueConfirmation(
  deps: { tokens: AuthTokenRepository; email: EmailSender; appUrl: string; now: () => Date },
  user: { id: string; email: string },
): Promise<void> {
  const token = generateToken();
  await deps.tokens.issue({
    userId: user.id,
    kind: 'confirm_email',
    tokenHash: hashToken(token),
    expiresAt: new Date(deps.now().getTime() + CONFIRM_EMAIL_TTL_MS),
  });
  await deps.email.send(confirmEmailMessage(user.email, confirmEmailLink(deps.appUrl, token)));
}
