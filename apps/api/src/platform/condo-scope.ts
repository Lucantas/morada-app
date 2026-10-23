import type { MiddlewareHandler } from 'hono';

import type { ApiEnv, CondoRoleName, Permission, Role } from './auth';

export type Scoped<T> = (condoId: string) => T;

export type ResolvedAccess = {
  role: Role;
  sub: string;
  condoRole: CondoRoleName;
  permissions: readonly Permission[];
};

export const VIEW_HEADER = 'X-Morada-View';

function requestedViewOf(header: string | undefined): Role | null {
  return header === 'admin' || header === 'resident' ? header : null;
}

export function condoAccessMiddleware(
  resolve: (
    userId: string,
    condoId: string,
    requestedView: Role | null,
  ) => Promise<ResolvedAccess | null>,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const condoId = c.req.param('condoId');
    const requestedView = requestedViewOf(c.req.header(VIEW_HEADER));
    const access = condoId ? await resolve(c.get('uid'), condoId, requestedView) : null;
    if (!condoId || !access) return c.json({ error: 'Condomínio não encontrado' }, 404);
    c.set('condoId', condoId);
    c.set('role', access.role);
    c.set('sub', access.sub);
    c.set('condoRole', access.condoRole);
    c.set('permissions', access.permissions);
    await next();
  };
}
