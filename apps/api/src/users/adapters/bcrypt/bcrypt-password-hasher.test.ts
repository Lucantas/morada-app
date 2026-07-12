import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher(4);

  test('hash produces an opaque digest, never the plaintext', async () => {
    const hash = await hasher.hash('s3nha-secreta');
    expect(hash).not.toBe('s3nha-secreta');
    expect(hash).not.toContain('s3nha-secreta');
    expect(hash.length).toBeGreaterThan(20);
  });

  test('verify accepts the correct password', async () => {
    const hash = await hasher.hash('s3nha-secreta');
    expect(await hasher.verify('s3nha-secreta', hash)).toBe(true);
  });

  test('verify rejects the wrong password', async () => {
    const hash = await hasher.hash('s3nha-secreta');
    expect(await hasher.verify('outra-senha', hash)).toBe(false);
  });

  test('hashing the same password twice yields different digests (salted)', async () => {
    const a = await hasher.hash('s3nha-secreta');
    const b = await hasher.hash('s3nha-secreta');
    expect(a).not.toBe(b);
  });
});
