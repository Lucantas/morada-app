import { Hono } from 'hono';

import { authMiddleware, type ApiEnv } from '../../../platform/auth';
import { listMyCondos } from '../../app/condo-access-views';
import type { CondoRepository } from '../../domain/condo-repository';

export function meRoutes(condos: Pick<CondoRepository, 'listForUser'>) {
  const app = new Hono<ApiEnv>();
  app.use('*', authMiddleware);
  app.get('/condos', async (c) => c.json(await listMyCondos(condos, c.get('uid'))));
  return app;
}
