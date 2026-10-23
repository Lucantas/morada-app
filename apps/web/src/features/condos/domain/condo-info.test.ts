import { condoInfoSchema, condoNameSchema } from './condo-info';

describe('condoInfoSchema', () => {
  test('accepts an id and a name', () => {
    expect(condoInfoSchema.parse({ id: 'c1', name: 'Residencial Ipê' })).toEqual({
      id: 'c1',
      name: 'Residencial Ipê',
    });
  });

  test('rejects a blank name', () => {
    expect(() => condoInfoSchema.parse({ id: 'c1', name: '' })).toThrow();
  });
});

describe('condoNameSchema', () => {
  test('trims surrounding whitespace', () => {
    expect(condoNameSchema.parse('  Residencial Ipê  ')).toBe('Residencial Ipê');
  });

  test('rejects whitespace only and names over 80 characters', () => {
    expect(condoNameSchema.safeParse('   ').success).toBe(false);
    expect(condoNameSchema.safeParse('x'.repeat(81)).success).toBe(false);
  });
});
