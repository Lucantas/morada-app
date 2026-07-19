import { Hono } from 'hono';

import type { ApiEnv } from '../auth';

export function healthRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/', (c) => c.json({ status: 'ok' }));
  return app;
}
