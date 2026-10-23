import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import { getDashboardSummary } from '../../app/get-dashboard-summary';
import type { DashboardRepository } from '../../domain/dashboard-repository';

interface DashboardRoutesDeps {
  dashboard: DashboardRepository;
}

export function dashboardRoutes(scope: Scoped<DashboardRoutesDeps>) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await getDashboardSummary(scope(c.get('condoId')).dashboard)));

  return app;
}
