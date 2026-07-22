import { parseWebOrigins } from './config';

describe('parseWebOrigins', () => {
  test('splits a comma-separated list and trims blanks', () => {
    expect(parseWebOrigins('https://a.dev, https://b.dev', false)).toEqual([
      'https://a.dev',
      'https://b.dev',
    ]);
  });

  test('throws in production when no origin is configured', () => {
    expect(() => parseWebOrigins(undefined, true)).toThrow(/WEB_ORIGIN/);
  });

  test('falls back to localhost in development', () => {
    expect(parseWebOrigins(undefined, false)).toEqual(['http://localhost:5173']);
  });
});
