import { pixCopyPaste } from './pix-code';

describe('pixCopyPaste', () => {
  test('encodes the receipt amount in reais', () => {
    const code = pixCopyPaste({ valueCents: 45000, ref: '04/2026' });
    expect(code).toContain('5406450.00');
  });

  test('embeds a txid derived from the receipt ref', () => {
    expect(pixCopyPaste({ valueCents: 45000, ref: '04/2026' })).toContain('MORADA042026');
  });

  test('starts with the Pix BR Code payload format indicator', () => {
    expect(pixCopyPaste({ valueCents: 1000, ref: '01/2026' })).toMatch(/^000201/);
  });
});
