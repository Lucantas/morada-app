import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { z } from 'zod';

import type { ApiEnv } from '../../../platform/auth';
import type { CondoSummary } from '../../../condos/app/condo-access-views';
import { config } from '../../../platform/config';
import { CSRF_COOKIE, SESSION_COOKIE, clearCookieOptions } from '../../../platform/cookies';
import { csrfMiddleware } from '../../../platform/csrf';
import type { RateLimiter } from '../../../platform/rate-limit';
import { verifyCredentials } from '../../app/verify-credentials';
import { normalizeEmail } from '../../domain/email';
import { InvalidCredentialsError } from '../../domain/errors';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { UserRepository } from '../../domain/user-repository';

import { sessionResponse } from './session-cookies';

const loginSchema = z
  .object({
    login: z.string().min(1).max(160).optional(),
    username: z.string().min(1).max(160).optional(),
    password: z.string().min(1).max(200),
  })
  .refine((body) => (body.login === undefined) !== (body.username === undefined), {
    message: 'Informe login',
  })
  .transform(({ login, username, password }) => ({
    login: (login ?? username ?? '').trim(),
    password,
  }));

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
    const { login, password } = loginSchema.parse(await c.req.json());
    const key = `${clientIpFrom(c)}:${login.includes('@') ? normalizeEmail(login) : login}`;

    if (!deps.limiter.check(key, Date.now()).allowed) {
      return c.json({ error: 'Muitas tentativas, tente mais tarde' }, 429);
    }

    let user;
    try {
      user = await verifyCredentials(deps.users, deps.hasher, login, password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        deps.limiter.fail(key, Date.now());
      }
      throw error;
    }

    const condos = await deps.condosFor(user.id);
    if (condos.length === 0 && user.email === null) throw new InvalidCredentialsError();

    deps.limiter.succeed(key);
    return sessionResponse(c, user, condos);
  });

  app.post('/logout', csrfMiddleware, (c) => {
    deleteCookie(c, SESSION_COOKIE, clearCookieOptions(config.isProduction));
    deleteCookie(c, CSRF_COOKIE, clearCookieOptions(config.isProduction));
    return c.body(null, 204);
  });

  return app;
}
