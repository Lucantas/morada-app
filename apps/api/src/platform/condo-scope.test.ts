import { Hono } from 'hono';

import { requirePermission, type ApiEnv, type Role } from './auth';
import { condoAccessMiddleware, VIEW_HEADER, type ResolvedAccess } from './condo-scope';

type Resolver = (
  userId: string,
  condoId: string,
  requestedView: Role | null,
) => Promise<ResolvedAccess | null>;

const sindicoAccess: ResolvedAccess = {
  role: 'admin',
  sub: 'u-1',
  condoRole: 'sindico',
  permissions: ['view_building', 'publish_notices', 'manage_residents', 'manage_money'],
};

function appWith(resolve: Resolver) {
  const scoped = new Hono<ApiEnv>();
  scoped.use('*', condoAccessMiddleware(resolve));
  scoped.get('/whoami', (c) =>
    c.json({
      condoId: c.get('condoId'),
      role: c.get('role'),
      sub: c.get('sub'),
      condoRole: c.get('condoRole'),
      permissions: c.get('permissions'),
    }),
  );
  scoped.get('/fees', requirePermission('manage_fees'), (c) => c.json({ ok: true }));
  scoped.get('/money', requirePermission('manage_money'), (c) => c.json({ ok: true }));
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    c.set('uid', 'u-1');
    await next();
  });
  app.route('/api/condos/:condoId', scoped);
  return app;
}

describe('condoAccessMiddleware', () => {
  test('answers 404 when the resolver returns null', async () => {
    const app = appWith(async () => null);

    const res = await app.request('/api/condos/condo-x/whoami');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Condomínio não encontrado' });
  });

  test('sets condoId, role, sub, condoRole and permissions for downstream handlers', async () => {
    const calls: [string, string, Role | null][] = [];
    const app = appWith(async (userId, condoId, requestedView) => {
      calls.push([userId, condoId, requestedView]);
      return { role: 'resident', sub: 'r-9', condoRole: 'morador', permissions: [] };
    });

    const res = await app.request('/api/condos/condo-x/whoami');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      condoId: 'condo-x',
      role: 'resident',
      sub: 'r-9',
      condoRole: 'morador',
      permissions: [],
    });
    expect(calls).toEqual([['u-1', 'condo-x', null]]);
  });

  test.each([
    ['resident', 'resident'],
    ['admin', 'admin'],
    ['owner', null],
    ['', null],
  ] as const)('maps the view header %p to %p', async (header, expected) => {
    const views: (Role | null)[] = [];
    const app = appWith(async (_userId, _condoId, requestedView) => {
      views.push(requestedView);
      return sindicoAccess;
    });

    await app.request('/api/condos/condo-x/whoami', { headers: { [VIEW_HEADER]: header } });

    expect(views).toEqual([expected]);
  });
});

describe('requirePermission', () => {
  test('answers 403 when the permission is missing and passes when present', async () => {
    const app = appWith(async () => sindicoAccess);

    const denied = await app.request('/api/condos/condo-x/fees');
    const allowed = await app.request('/api/condos/condo-x/money');

    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: 'Acesso negado' });
    expect(allowed.status).toBe(200);
  });
});
