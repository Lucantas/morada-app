import { accountSchema } from './account';

describe('accountSchema — proof fields', () => {
  const base = {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
    valueCents: 5000,
    status: 'pago' as const,
  };

  test('accepts a data-URL proofDataUrl', () => {
    const parsed = accountSchema.parse({
      ...base,
      proofDataUrl: 'data:application/pdf;base64,JVBERi0=',
    });
    expect(parsed.proofDataUrl).toBe('data:application/pdf;base64,JVBERi0=');
  });

  test('accepts null (clear) and undefined (untouched) proofDataUrl', () => {
    expect(accountSchema.parse({ ...base, proofDataUrl: null }).proofDataUrl).toBeNull();
    expect(accountSchema.parse(base).proofDataUrl).toBeUndefined();
  });

  test('rejects a non-data-URL proofDataUrl', () => {
    expect(() => accountSchema.parse({ ...base, proofDataUrl: 'nope' })).toThrow();
  });

  test('carries hasProof through reads', () => {
    expect(accountSchema.parse({ ...base, hasProof: true }).hasProof).toBe(true);
  });
});
