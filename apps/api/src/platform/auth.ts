import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';

import { config } from './config';
import { SESSION_COOKIE } from './cookies';

export type Role = 'admin' | 'resident';

/** `sub` identifies the resident (their thread id); admins get 'admin'. */
export type ApiEnv = { Variables: { role: Role; sub: string } };

const EIGHT_HOURS = 60 * 60 * 8;

export async function signSession(role: Role, subject: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ role, sub: subject, iat: now, exp: now + EIGHT_HOURS }, config.jwtSecret, 'HS256');
}

export const authMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: 'Não autenticado' }, 401);
  try {
    const payload = await verify(token, config.jwtSecret, 'HS256');
    const role = payload.role;
    const sub = payload.sub;
    if ((role !== 'admin' && role !== 'resident') || typeof sub !== 'string') {
      return c.json({ error: 'Sessão inválida' }, 401);
    }
    c.set('role', role);
    c.set('sub', sub);
    await next();
    return;
  } catch {
    return c.json({ error: 'Sessão inválida' }, 401);
  }
};

export function requireRole(role: Role): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (c.get('role') !== role) return c.json({ error: 'Acesso negado' }, 403);
    await next();
  };
}
