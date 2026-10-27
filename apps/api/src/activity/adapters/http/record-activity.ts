import type { MiddlewareHandler } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { logServerError } from '../../../platform/http-error';
import type { Scoped } from '../../../platform/condo-scope';
import type { ActivityAction } from '../../domain/activity';
import type { ActivityRepository } from '../../domain/activity-repository';

export type ActivityResolver = (method: string, routePath: string) => ActivityAction | null;

const NEEDS_CREATED_RESULT: ReadonlySet<ActivityAction> = new Set(['receipt.monthly']);

const CREATED_WHEN_201: Readonly<Partial<Record<ActivityAction, ActivityAction>>> = {
  'account.updated': 'account.created',
};

async function createdSomething(res: Response): Promise<boolean> {
  const body: unknown = await res.clone().json();
  return Array.isArray(body) && body.length > 0;
}

export function recordActivity(
  resolve: ActivityResolver,
  activityFor: Scoped<Pick<ActivityRepository, 'record'>>,
  now: () => Date,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    await next();
    if (c.req.method === 'GET') return;
    if (c.res.status < 200 || c.res.status >= 300) return;
    const resolved = resolve(c.req.method, c.req.routePath);
    if (resolved === null) return;
    const action = c.res.status === 201 ? (CREATED_WHEN_201[resolved] ?? resolved) : resolved;
    try {
      if (NEEDS_CREATED_RESULT.has(action) && !(await createdSomething(c.res))) return;
      await activityFor(c.get('condoId')).record({
        actorUserId: c.get('uid'),
        action,
        subjectId: c.req.param('id') ?? null,
        at: now(),
      });
    } catch (error) {
      logServerError('Activity log failed:', error);
    }
  };
}

export function resolverFromTable(
  table: Readonly<Record<string, ActivityAction>>,
): ActivityResolver {
  return (method, routePath) => table[`${method} ${routePath}`] ?? null;
}
