import { generateToken, hashToken } from '../../platform/tokens';
import { RESET_PASSWORD_TTL_MS } from '../domain/auth-token';
import type { AuthTokenRepository } from '../domain/auth-token-repository';

import { resetPasswordLink } from './emails';

export async function issuePasswordReset(
  deps: { tokens: AuthTokenRepository; appUrl: string; now: () => Date },
  userId: string,
): Promise<string> {
  const now = deps.now();
  await deps.tokens.revokeAll(userId, 'reset_password', now);
  const token = generateToken();
  await deps.tokens.issue({
    userId,
    kind: 'reset_password',
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + RESET_PASSWORD_TTL_MS),
  });
  return resetPasswordLink(deps.appUrl, token);
}
