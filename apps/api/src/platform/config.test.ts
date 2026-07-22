import { parseWebOrigins, parseR2Config } from './config';

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

describe('parseR2Config', () => {
  const fullEnv = {
    R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
    R2_ACCESS_KEY_ID: 'key-id',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'proofs',
  };

  test('returns a config object when all 4 env vars are set', () => {
    expect(parseR2Config(fullEnv)).toEqual({
      endpoint: 'https://example.r2.cloudflarestorage.com',
      accessKeyId: 'key-id',
      secretAccessKey: 'secret',
      bucket: 'proofs',
    });
  });

  test.each(['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'])(
    'returns null when %s is missing',
    (missingKey) => {
      const env = { ...fullEnv, [missingKey]: undefined };
      expect(parseR2Config(env)).toBeNull();
    },
  );

  test('returns null when no env vars are set', () => {
    expect(parseR2Config({})).toBeNull();
  });
});
