import { brCode } from './pix-code';

describe('brCode', () => {
  test('matches the Bacen manual example', () => {
    const code = brCode({
      key: '123e4567-e12b-12d1-a456-426655440000',
      receiverName: 'Fulano de Tal',
      city: 'BRASILIA',
    });

    expect(code).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });

  test('includes the amount and strips accents', () => {
    const code = brCode({
      key: 'a@b.com',
      receiverName: 'Condomínio',
      city: 'São Paulo',
      amountCents: 35000,
    });

    expect(code).toContain('5406350.00');
    expect(code).toContain('6009Sao Paulo');
    expect(code).toContain('5910Condominio');
  });

  test('omits the amount when it is zero or absent', () => {
    const base = { key: 'a@b.com', receiverName: 'X', city: 'Y' };

    expect(brCode({ ...base, amountCents: 0 })).not.toContain('54');
    expect(brCode(base)).not.toMatch(/5303986540/);
  });

  test('uses the given txid', () => {
    const code = brCode({ key: 'a@b.com', receiverName: 'X', city: 'Y', txid: 'ABC123' });

    expect(code).toContain('62100506ABC123');
  });
});
