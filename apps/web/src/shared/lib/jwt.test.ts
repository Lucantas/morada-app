import { decodeJwtSubject, isJwtActive } from './jwt';

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

describe('isJwtActive', () => {
  const nowSec = Math.floor(Date.now() / 1000);

  test('is true for a token that expires in the future', () => {
    expect(isJwtActive(makeToken({ sub: 'r-1', exp: nowSec + 3600 }))).toBe(true);
  });

  test('is false for an expired token', () => {
    expect(isJwtActive(makeToken({ sub: 'r-1', exp: nowSec - 10 }))).toBe(false);
  });

  test('is false when there is no exp claim', () => {
    expect(isJwtActive(makeToken({ sub: 'r-1' }))).toBe(false);
  });

  test('is false for a malformed token', () => {
    expect(isJwtActive('not-a-jwt')).toBe(false);
  });
});
