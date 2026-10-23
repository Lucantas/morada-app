import { Hono } from 'hono';

import { authMiddleware, requireRole, type ApiEnv } from '../../../platform/auth';
import { getCondoInfo, renameCondo } from '../../app/condo-info';
import { listMyCondos } from '../../app/condo-access-views';
import type { CondoRepository } from '../../domain/condo-repository';

export function meRoutes(condos: Pick<CondoRepository, 'listForUser'>) {
  const app = new Hono<ApiEnv>();
  app.use('*', authMiddleware);
  app.get('/condos', async (c) => c.json(await listMyCondos(condos, c.get('uid'))));
  return app;
}

export function condoInfoRoutes(condos: Pick<CondoRepository, 'getById' | 'rename'>) {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await getCondoInfo(condos, c.get('condoId'))));
  app.put('/', requireRole('admin'), async (c) =>
    c.json(await renameCondo(condos, c.get('condoId'), await c.req.json())),
  );
  return app;
}
