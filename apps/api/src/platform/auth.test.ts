import { Hono } from 'hono';
import { sign } from 'hono/jwt';

import { authMiddleware, signSession, type ApiEnv } from './auth';
import { config } from './config';

function appWith(versions: Record<string, number>) {
  const app = new Hono<ApiEnv>();
  app.use(
    '*',
    authMiddleware(async (userId) => versions[userId] ?? null),
  );
  app.get('/', (c) => c.json({ uid: c.get('uid') }));
  return app;
}

function requestWith(app: Hono<ApiEnv>, token: string) {
  return app.request('/', { headers: { Cookie: `session=${token}` } });
}

describe('authMiddleware', () => {
  test('accepts a session signed with the current version', async () => {
    const app = appWith({ 'u-1': 3 });

    const res = await requestWith(app, await signSession('u-1', 3));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: 'u-1' });
  });

  test('rejects a session signed with an older version', async () => {
    const app = appWith({ 'u-1': 4 });

    const res = await requestWith(app, await signSession('u-1', 3));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sessão inválida' });
  });

  test('rejects a session whose user no longer exists', async () => {
    const res = await requestWith(appWith({}), await signSession('u-1', 0));

    expect(res.status).toBe(401);
  });

  test('rejects a session without a version', async () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = await sign({ uid: 'u-1', iat: now, exp: now + 60 }, config.jwtSecret, 'HS256');

    const res = await requestWith(appWith({ 'u-1': 0 }), legacy);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sessão inválida' });
  });

  test('a failing version lookup never reaches the handler', async () => {
    const reached = jest.fn();
    const app = new Hono<ApiEnv>();
    app.use(
      '*',
      authMiddleware(async () => {
        throw new Error('db down');
      }),
    );
    app.get('/', (c) => {
      reached();
      return c.json({});
    });

    const res = await requestWith(app, await signSession('u-1', 0));

    expect(res.ok).toBe(false);
    expect(reached).not.toHaveBeenCalled();
  });

  test('rejects a missing cookie and a forged token', async () => {
    const app = appWith({ 'u-1': 0 });

    expect((await app.request('/')).status).toBe(401);
    expect((await requestWith(app, 'not-a-jwt')).status).toBe(401);
  });
});
