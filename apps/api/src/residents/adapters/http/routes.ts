import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getResident } from '../../app/get-resident';
import { listResidents } from '../../app/list-residents';
import { saveResident } from '../../app/save-resident';
import { residentDraftSchema } from '../../domain/resident';
import type { ResidentRepository } from '../../domain/resident-repository';

export function residentRoutes(repo: ResidentRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', (c) => c.json(listResidents(repo)));

  app.get('/:id', (c) => c.json(getResident(repo, c.req.param('id'))));

  app.post('/', async (c) => {
    const draft = residentDraftSchema.parse(await c.req.json());
    return c.json(saveResident(repo, draft), 201);
  });

  app.put('/:id', async (c) => {
    const draft = residentDraftSchema.parse({ ...(await c.req.json()), id: c.req.param('id') });
    return c.json(saveResident(repo, draft));
  });

  return app;
}
