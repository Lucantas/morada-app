import { receiptMethodSchema } from './receipt';

describe('receiptMethodSchema', () => {
  it('accepts dinheiro and pix', () => {
    expect(receiptMethodSchema.parse('dinheiro')).toBe('dinheiro');
    expect(receiptMethodSchema.parse('pix')).toBe('pix');
  });

  it('rejects boleto and cartao', () => {
    expect(() => receiptMethodSchema.parse('boleto')).toThrow();
    expect(() => receiptMethodSchema.parse('cartao')).toThrow();
  });
});
