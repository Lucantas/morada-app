import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getDashboardSummary } from '../../app/get-dashboard-summary';
import type { DashboardRepository } from '../../domain/dashboard-repository';

export function dashboardRoutes(repo: DashboardRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', (c) => c.json(getDashboardSummary(repo)));

  return app;
}
