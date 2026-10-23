import type { MiddlewareHandler } from 'hono';

import type { ApiEnv, Role } from './auth';

export type Scoped<T> = (condoId: string) => T;

export type ResolvedAccess = { role: Role; sub: string };

export function condoAccessMiddleware(
  resolve: (userId: string, condoId: string) => Promise<ResolvedAccess | null>,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const condoId = c.req.param('condoId');
    const access = condoId ? await resolve(c.get('uid'), condoId) : null;
    if (!condoId || !access) return c.json({ error: 'Condomínio não encontrado' }, 404);
    c.set('condoId', condoId);
    c.set('role', access.role);
    c.set('sub', access.sub);
    await next();
  };
}
