import { Hono } from 'hono';
import { z } from 'zod';

import type { Scoped } from '../../../platform/condo-scope';
import { requireRole, type ApiEnv } from '../../../platform/auth';
import { generateTempPassword } from '../../../platform/temp-password';
import type { ResidentRepository } from '../../../residents/domain/resident-repository';
import { createResidentLogin } from '../../app/create-resident-login';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { UserRepository } from '../../domain/user-repository';

const provisionSchema = z.object({
  residentId: z.string().min(1).max(64),
});

interface UserRoutesDeps {
  users: UserRepository;
  residents: ResidentRepository;
}

export function userRoutes(scope: Scoped<UserRoutesDeps>, hasher: PasswordHasher) {
  const app = new Hono<ApiEnv>();

  app.post('/', requireRole('admin'), async (c) => {
    const deps = scope(c.get('condoId'));
    const { residentId } = provisionSchema.parse(await c.req.json());
    const tempPassword = generateTempPassword();
    const user = await createResidentLogin(deps.users, hasher, (id) => deps.residents.getById(id), {
      password: tempPassword,
      residentId,
    });
    return c.json(
      { id: user.id, username: user.username, residentId: user.residentId, tempPassword },
      201,
    );
  });

  return app;
}
