import { emailSchema, normalizeEmail } from './email';

describe('email', () => {
  test('email is normalized', () => {
    expect(normalizeEmail(' Ana@X.com ')).toBe('ana@x.com');
    expect(emailSchema.parse(' Ana@X.com ')).toBe('ana@x.com');
  });

  test('rejects an address without a domain', () => {
    expect(emailSchema.safeParse('ana').success).toBe(false);
  });

  test('rejects an address longer than 160 characters', () => {
    const tooLong = `${'a'.repeat(150)}@example.com`;
    expect(tooLong).toHaveLength(162);
    expect(emailSchema.safeParse(tooLong).success).toBe(false);
  });
});
