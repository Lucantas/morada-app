function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  const encodedPayload = segments.length === 3 ? segments[1] : undefined;
  if (encodedPayload === undefined) return null;
  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function decodeJwtSubject(token: string): string | null {
  const sub = decodeJwtPayload(token)?.sub;
  return typeof sub === 'string' ? sub : null;
}

/** True when the token has a future `exp` claim (seconds since epoch). */
export function isJwtActive(token: string): boolean {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' && exp * 1000 > Date.now();
}
