import type { MiddlewareHandler } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { OrganizationRepository } from '../../domain/organization-repository';

export function orgOwnerMiddleware(
  organizations: Pick<OrganizationRepository, 'isActiveOwner'>,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const orgId = c.req.param('orgId');
    if (!orgId || !(await organizations.isActiveOwner(orgId, c.get('uid')))) {
      return c.json({ error: 'Organização não encontrada' }, 404);
    }
    c.set('orgId', orgId);
    await next();
  };
}
