import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';

import { config } from './config';

export type Role = 'admin' | 'resident';

export type ApiEnv = { Variables: { role: Role } };

const EIGHT_HOURS = 60 * 60 * 8;

export async function signSession(role: Role): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ role, iat: now, exp: now + EIGHT_HOURS }, config.jwtSecret, 'HS256');
}

export const authMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return c.json({ error: 'Não autenticado' }, 401);
  try {
    const payload = await verify(token, config.jwtSecret, 'HS256');
    const role = payload.role;
    if (role !== 'admin' && role !== 'resident') return c.json({ error: 'Sessão inválida' }, 401);
    c.set('role', role);
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
