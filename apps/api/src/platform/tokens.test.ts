import { generateToken, hashToken } from './tokens';

describe('tokens', () => {
  test('generateToken returns 43 base64url characters', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test('generateToken returns a different value each call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  test('hashToken is a deterministic 64-char hex digest', () => {
    const hash = hashToken('abc');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).toBe(hash);
    expect(hashToken('abd')).not.toBe(hash);
  });
});
