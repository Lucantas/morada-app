import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

import type { ApiEnv } from './auth';
import { CSRF_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }
  const cookie = getCookie(c, CSRF_COOKIE);
  const header = c.req.header('X-CSRF-Token');
  if (!cookie || !header || cookie !== header) {
    return c.json({ error: 'CSRF inválido' }, 403);
  }
  await next();
};
