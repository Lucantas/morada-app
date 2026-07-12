export function decodeJwtSubject(token: string): string | null {
  const segments = token.split('.');
  const encodedPayload = segments.length === 3 ? segments[1] : undefined;
  if (encodedPayload === undefined) return null;
  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
