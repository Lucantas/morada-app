import { Hono } from 'hono';
import { z } from 'zod';

import { signSession, type ApiEnv } from '../../../platform/auth';
import { verifyCredentials } from '../../app/verify-credentials';
import { InvalidCredentialsError } from '../../domain/errors';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { UserRepository } from '../../domain/user-repository';

const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
});

export function authRoutes(deps: {
  users: UserRepository;
  hasher: PasswordHasher;
  isResidentActive: (residentId: string | null) => Promise<boolean>;
}) {
  const app = new Hono<ApiEnv>();

  app.post('/login', async (c) => {
    const { username, password } = loginSchema.parse(await c.req.json());
    const user = await verifyCredentials(deps.users, deps.hasher, username, password);
    if (user.role === 'resident' && !(await deps.isResidentActive(user.residentId))) {
      throw new InvalidCredentialsError();
    }
    const subject = user.role === 'resident' ? (user.residentId ?? user.id) : user.id;
    return c.json({ token: await signSession(user.role, subject), role: user.role });
  });

  return app;
}
