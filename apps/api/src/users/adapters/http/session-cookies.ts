import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';

import type { CondoSummary } from '../../../condos/app/condo-access-views';
import { signSession, type ApiEnv } from '../../../platform/auth';
import { config } from '../../../platform/config';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  csrfCookieOptions,
  newCsrfToken,
  sessionCookieOptions,
} from '../../../platform/cookies';
import { isEmailVerified, type User } from '../../domain/user';

export async function sessionResponse(
  c: Context<ApiEnv>,
  user: User,
  condos: CondoSummary[],
): Promise<Response> {
  const token = await signSession(user.id, user.sessionVersion);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(config.isProduction));
  setCookie(c, CSRF_COOKIE, newCsrfToken(), csrfCookieOptions(config.isProduction));
  return c.json({ condos, emailVerified: isEmailVerified(user) });
}
