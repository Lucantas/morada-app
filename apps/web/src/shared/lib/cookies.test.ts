import { readCookie } from './cookies';

describe('readCookie', () => {
  test('returns the value for a present cookie', () => {
    Object.defineProperty(document, 'cookie', { value: 'a=1; csrf=abc; b=2', configurable: true });
    expect(readCookie('csrf')).toBe('abc');
  });

  test('returns null when the cookie is absent', () => {
    Object.defineProperty(document, 'cookie', { value: 'a=1', configurable: true });
    expect(readCookie('csrf')).toBeNull();
  });
});
