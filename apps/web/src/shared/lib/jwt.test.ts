import { decodeJwtSubject } from './jwt';

function makeToken(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`;
}

describe('decodeJwtSubject', () => {
  test('returns the sub claim from a valid token', () => {
    const token = makeToken({ sub: 'r-1', role: 'resident' });
    expect(decodeJwtSubject(token)).toBe('r-1');
  });

  test('returns null when there is no sub claim', () => {
    expect(decodeJwtSubject(makeToken({ role: 'admin' }))).toBeNull();
  });

  test('returns null for a malformed token', () => {
    expect(decodeJwtSubject('not-a-jwt')).toBeNull();
  });

  test('returns null for a token whose payload is not valid JSON', () => {
    expect(decodeJwtSubject('header.$$$notbase64$$$.sig')).toBeNull();
  });
});
