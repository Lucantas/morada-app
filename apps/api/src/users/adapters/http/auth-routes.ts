import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { signSession, type ApiEnv } from '../../../platform/auth';
import type { CondoSummary } from '../../../condos/app/condo-access-views';
import { config } from '../../../platform/config';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearCookieOptions,
  csrfCookieOptions,
  newCsrfToken,
  sessionCookieOptions,
} from '../../../platform/cookies';
import { csrfMiddleware } from '../../../platform/csrf';
import type { RateLimiter } from '../../../platform/rate-limit';
import { verifyCredentials } from '../../app/verify-credentials';
import { InvalidCredentialsError } from '../../domain/errors';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { UserRepository } from '../../domain/user-repository';

const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
});

function clientIpFrom(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('Fly-Client-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export function authRoutes(deps: {
  users: UserRepository;
  hasher: PasswordHasher;
  condosFor: (userId: string) => Promise<CondoSummary[]>;
  limiter: RateLimiter;
}) {
  const app = new Hono<ApiEnv>();

  app.post('/login', async (c) => {
    const { username, password } = loginSchema.parse(await c.req.json());
    const key = `${clientIpFrom(c)}:${username}`;

    if (!deps.limiter.check(key, Date.now()).allowed) {
      return c.json({ error: 'Muitas tentativas, tente mais tarde' }, 429);
    }

    let user;
    try {
      user = await verifyCredentials(deps.users, deps.hasher, username, password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        deps.limiter.fail(key, Date.now());
      }
      throw error;
    }

    const condos = await deps.condosFor(user.id);
    if (condos.length === 0) throw new InvalidCredentialsError();

    deps.limiter.succeed(key);
    const token = await signSession(user.id);
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(config.isProduction));
    setCookie(c, CSRF_COOKIE, newCsrfToken(), csrfCookieOptions(config.isProduction));
    return c.json({ condos });
  });

  app.post('/logout', csrfMiddleware, (c) => {
    deleteCookie(c, SESSION_COOKIE, clearCookieOptions(config.isProduction));
    deleteCookie(c, CSRF_COOKIE, clearCookieOptions(config.isProduction));
    return c.body(null, 204);
  });

  return app;
}
