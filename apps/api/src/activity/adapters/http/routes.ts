import { Hono } from 'hono';

import { requirePermission, type ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import { listActivity } from '../../app/list-activity';
import type { ActivityRepository } from '../../domain/activity-repository';

interface ActivityRoutesDeps {
  activity: ActivityRepository;
}

export function activityRoutes(scope: Scoped<ActivityRoutesDeps>) {
  const app = new Hono<ApiEnv>();

  app.get('/', requirePermission('view_activity'), async (c) =>
    c.json(await listActivity(scope(c.get('condoId')).activity)),
  );

  return app;
}
