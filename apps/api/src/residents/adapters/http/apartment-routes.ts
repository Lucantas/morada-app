import { Hono } from 'hono';

import type { Scoped } from '../../../platform/condo-scope';
import { requireRole, type ApiEnv } from '../../../platform/auth';
import type { ResidentRepository } from '../../domain/resident-repository';

interface ApartmentResidentRoutesDeps {
  residents: ResidentRepository;
}

export function apartmentResidentRoutes(scope: Scoped<ApartmentResidentRoutesDeps>) {
  const app = new Hono<ApiEnv>();

  // Admin: an apartment's occupant history — the current resident plus everyone
  // who has moved out (active-first). Powers the "moradores antigos" view.
  app.get('/:id/residents', requireRole('admin'), async (c) => {
    const { residents } = scope(c.get('condoId'));
    return c.json(await residents.listByApartment(c.req.param('id')));
  });

  return app;
}
