import type { MiddlewareHandler } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import type { ActivityAction } from '../../domain/activity';
import type { ActivityRepository } from '../../domain/activity-repository';

export type ActivityResolver = (method: string, routePath: string) => ActivityAction | null;

export function recordActivity(
  resolve: ActivityResolver,
  activityFor: Scoped<Pick<ActivityRepository, 'record'>>,
  now: () => Date,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    await next();
    if (c.req.method === 'GET') return;
    if (c.res.status < 200 || c.res.status >= 300) return;
    const action = resolve(c.req.method, c.req.routePath);
    if (action === null) return;
    await activityFor(c.get('condoId')).record({
      actorUserId: c.get('uid'),
      action,
      subjectId: c.req.param('id') ?? null,
      at: now(),
    });
  };
}

export function resolverFromTable(
  table: Readonly<Record<string, ActivityAction>>,
): ActivityResolver {
  return (method, routePath) => table[`${method} ${routePath}`] ?? null;
}
