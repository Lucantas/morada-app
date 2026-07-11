import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { authMiddleware, requireRole, signSession, type ApiEnv, type Role } from './platform/auth';
import { config } from './platform/config';
import { createDb, type Db } from './platform/db';
import { onError } from './platform/http-error';
import { residentRoutes } from './residents/adapters/http/routes';
import { SqliteResidentRepository } from './residents/adapters/sqlite/resident-repository';
import { seedDatabase } from './seed-data';

const loginSchema = z.object({ role: z.enum(['admin', 'resident']) });

function guarded(role: Role, routes: Hono<ApiEnv>): Hono<ApiEnv> {
  const group = new Hono<ApiEnv>();
  group.use('*', requireRole(role));
  group.route('/', routes);
  return group;
}

export function buildApp(db: Db) {
  seedDatabase(db);
  const residents = new SqliteResidentRepository(db);

  const app = new Hono<ApiEnv>();
  app.onError(onError);
  app.use(
    '*',
    cors({
      origin: config.webOrigin,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.post('/auth/login', async (c) => {
    const { role } = loginSchema.parse(await c.req.json());
    return c.json({ token: await signSession(role), role });
  });

  const api = new Hono<ApiEnv>();
  api.use('*', authMiddleware);
  api.route('/residents', guarded('admin', residentRoutes(residents)));
  app.route('/api', api);

  return app;
}

export function createApp() {
  return buildApp(createDb(config.dbPath));
}
