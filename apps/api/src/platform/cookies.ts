import { randomUUID } from 'node:crypto';
import type { CookieOptions } from 'hono/utils/cookie';

export const SESSION_COOKIE = 'session';
export const CSRF_COOKIE = 'csrf';

const EIGHT_HOURS_SECONDS = 60 * 60 * 8;

export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: EIGHT_HOURS_SECONDS,
    secure: isProduction,
  };
}

export function csrfCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: false,
    sameSite: 'Strict',
    path: '/',
    maxAge: EIGHT_HOURS_SECONDS,
    secure: isProduction,
  };
}

export function clearCookieOptions(isProduction: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 0, secure: isProduction };
}

export function newCsrfToken(): string {
  return randomUUID();
}
