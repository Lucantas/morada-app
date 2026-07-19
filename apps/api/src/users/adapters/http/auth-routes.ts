import { Hono } from 'hono';
import { z } from 'zod';

import { signSession, type ApiEnv } from '../../../platform/auth';
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
  isResidentActive: (residentId: string | null) => Promise<boolean>;
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

    if (user.role === 'resident' && !(await deps.isResidentActive(user.residentId))) {
      throw new InvalidCredentialsError();
    }

    deps.limiter.succeed(key);
    const subject = user.role === 'resident' ? (user.residentId ?? user.id) : user.id;
    return c.json({ token: await signSession(user.role, subject), role: user.role });
  });

  return app;
}
