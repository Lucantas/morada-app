import { Hono } from 'hono';

import { requirePermission, type ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import type { ReceiptRepository } from '../../../receipts/domain/receipt-repository';
import type { ResidentRepository } from '../../../residents/domain/resident-repository';
import { getBuilding } from '../../app/get-building';
import { addApartment, deactivateApartment, renameApartment } from '../../app/manage-apartments';
import type { BuildingRepository } from '../../domain/building-repository';

interface BuildingRoutesDeps {
  building: BuildingRepository;
  residents: ResidentRepository;
  receipts: ReceiptRepository;
}

export function buildingRoutes(scope: Scoped<BuildingRoutesDeps>): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();

  app.get('/', requirePermission('view_building'), async (c) => {
    const { building, residents, receipts } = scope(c.get('condoId'));
    return c.json(await getBuilding(building, residents, receipts));
  });

  app.post('/apartments', requirePermission('manage_condo'), async (c) => {
    const { building } = scope(c.get('condoId'));
    return c.json(await addApartment(building, await c.req.json()), 201);
  });

  app.put('/apartments/:id', requirePermission('manage_condo'), async (c) => {
    const { building } = scope(c.get('condoId'));
    return c.json(await renameApartment(building, c.req.param('id'), await c.req.json()));
  });

  app.post('/apartments/:id/deactivate', requirePermission('manage_condo'), async (c) => {
    const { building } = scope(c.get('condoId'));
    await deactivateApartment(building, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
