import { roleSchema } from './session';

describe('roleSchema', () => {
  test('accepts the two valid roles', () => {
    expect(roleSchema.parse('admin')).toBe('admin');
    expect(roleSchema.parse('resident')).toBe('resident');
  });

  test('rejects an unknown role', () => {
    expect(roleSchema.safeParse('superuser').success).toBe(false);
  });
});
