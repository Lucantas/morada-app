import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';

import { config } from './config';
import { SESSION_COOKIE } from './cookies';

export type Role = 'admin' | 'resident';

export type CondoRoleName = 'administrador' | 'sindico' | 'morador';

export type Permission =
  | 'view_building'
  | 'publish_notices'
  | 'manage_residents'
  | 'manage_money'
  | 'manage_fees'
  | 'manage_condo'
  | 'view_activity';

export type ApiEnv = {
  Variables: {
    uid: string;
    role: Role;
    sub: string;
    condoId: string;
    orgId: string;
    condoRole: CondoRoleName;
    permissions: readonly Permission[];
  };
};

const EIGHT_HOURS = 60 * 60 * 8;

export type SessionVersionResolver = (userId: string) => Promise<number | null>;

export async function signSession(userId: string, sessionVersion: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { uid: userId, sv: sessionVersion, iat: now, exp: now + EIGHT_HOURS },
    config.jwtSecret,
    'HS256',
  );
}

async function sessionClaims(token: string): Promise<{ uid: string; sv: number } | null> {
  try {
    const { uid, sv } = await verify(token, config.jwtSecret, 'HS256');
    if (typeof uid !== 'string' || uid === '') return null;
    if (typeof sv !== 'number' || !Number.isInteger(sv)) return null;
    return { uid, sv };
  } catch {
    return null;
  }
}

export async function currentSessionUser(
  token: string,
  resolveSessionVersion: SessionVersionResolver,
): Promise<string | null> {
  const claims = await sessionClaims(token);
  if (!claims || (await resolveSessionVersion(claims.uid)) !== claims.sv) return null;
  return claims.uid;
}

export function authMiddleware(
  resolveSessionVersion: SessionVersionResolver,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return c.json({ error: 'Não autenticado' }, 401);
    const uid = await currentSessionUser(token, resolveSessionVersion);
    if (uid === null) return c.json({ error: 'Sessão inválida' }, 401);
    c.set('uid', uid);
    await next();
  };
}

export function requireRole(role: Role): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (c.get('role') !== role) return c.json({ error: 'Acesso negado' }, 403);
    await next();
  };
}

export function requirePermission(permission: Permission): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (!c.get('permissions').includes(permission)) {
      return c.json({ error: 'Acesso negado' }, 403);
    }
    await next();
  };
}
