import { Hono, type MiddlewareHandler } from 'hono';

import { csrfMiddleware } from '../../../platform/csrf';
import { requirePermission, type ApiEnv } from '../../../platform/auth';
import { getCondoInfo, renameCondo } from '../../app/condo-info';
import { createMyCondominium } from '../../app/create-my-condominium';
import { listMyCondos } from '../../app/condo-access-views';
import type { CondoRepository } from '../../domain/condo-repository';
import { isEmailVerified } from '../../../users/domain/user';
import type { UserRepository } from '../../../users/domain/user-repository';

export function meRoutes(deps: {
  auth: MiddlewareHandler<ApiEnv>;
  condos: Pick<
    CondoRepository,
    'listForUser' | 'ownedOrganization' | 'createOrganization' | 'create' | 'grant'
  >;
  users: Pick<UserRepository, 'findById'>;
}) {
  const { condos, users } = deps;
  const app = new Hono<ApiEnv>();
  app.use('*', deps.auth);
  app.use('*', csrfMiddleware);
  app.get('/', async (c) => {
    const user = await users.findById(c.get('uid'));
    if (!user) return c.json({ error: 'Sessão inválida' }, 401);
    return c.json({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: isEmailVerified(user),
      condos: await listMyCondos(condos, user.id),
    });
  });
  app.get('/condos', async (c) => c.json(await listMyCondos(condos, c.get('uid'))));
  app.post('/condos', async (c) => {
    const user = await users.findById(c.get('uid'));
    if (!user) return c.json({ error: 'Sessão inválida' }, 401);
    const body: unknown = await c.req.json().catch(() => undefined);
    return c.json(await createMyCondominium(condos, user, body), 201);
  });
  return app;
}

export function condoInfoRoutes(condos: Pick<CondoRepository, 'getById' | 'rename'>) {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await getCondoInfo(condos, c.get('condoId'))));
  app.put('/', requirePermission('manage_condo'), async (c) =>
    c.json(await renameCondo(condos, c.get('condoId'), await c.req.json().catch(() => undefined))),
  );
  return app;
}
