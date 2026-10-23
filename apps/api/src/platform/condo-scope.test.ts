import { Hono } from 'hono';

import type { ApiEnv } from './auth';
import { condoAccessMiddleware, type ResolvedAccess } from './condo-scope';

function appWith(resolve: (userId: string, condoId: string) => Promise<ResolvedAccess | null>) {
  const scoped = new Hono<ApiEnv>();
  scoped.use('*', condoAccessMiddleware(resolve));
  scoped.get('/whoami', (c) =>
    c.json({ condoId: c.get('condoId'), role: c.get('role'), sub: c.get('sub') }),
  );
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

  test('sets condoId, role and sub for downstream handlers', async () => {
    const calls: [string, string][] = [];
    const app = appWith(async (userId, condoId) => {
      calls.push([userId, condoId]);
      return { role: 'resident', sub: 'r-9' };
    });

    const res = await app.request('/api/condos/condo-x/whoami');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ condoId: 'condo-x', role: 'resident', sub: 'r-9' });
    expect(calls).toEqual([['u-1', 'condo-x']]);
  });
});
