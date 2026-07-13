import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { deactivateResident } from '../../app/deactivate-resident';
import { getResident } from '../../app/get-resident';
import { listResidents } from '../../app/list-residents';
import { saveResident } from '../../app/save-resident';
import { residentDraftSchema } from '../../domain/resident';
import type { ResidentRepository } from '../../domain/resident-repository';

export function residentRoutes(repo: ResidentRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await listResidents(repo)));

  app.get('/:id', async (c) => c.json(await getResident(repo, c.req.param('id'))));

  app.post('/', async (c) => {
    const draft = residentDraftSchema.parse(await c.req.json());
    // POST always creates: ignore any client-supplied id so it can't overwrite.
    return c.json(await saveResident(repo, { ...draft, id: undefined }), 201);
  });

  app.put('/:id', async (c) => {
    const draft = residentDraftSchema.parse({ ...(await c.req.json()), id: c.req.param('id') });
    return c.json(await saveResident(repo, draft));
  });

  // Move-out: free the apartment for the next occupant (history preserved).
  app.post('/:id/deactivate', async (c) => {
    await deactivateResident(repo, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
