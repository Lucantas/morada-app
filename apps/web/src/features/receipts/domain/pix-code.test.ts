import { brCode } from './pix-code';

function parseTlv(payload: string): Array<{ id: string; value: string }> {
  const fields: Array<{ id: string; value: string }> = [];
  let cursor = 0;
  while (cursor < payload.length) {
    const id = payload.slice(cursor, cursor + 2);
    const length = Number(payload.slice(cursor + 2, cursor + 4));
    const value = payload.slice(cursor + 4, cursor + 4 + length);
    if (value.length !== length) throw new Error(`bad length at ${cursor}`);
    fields.push({ id, value });
    cursor += 4 + length;
  }
  return fields;
}

function valueOf(payload: string, id: string): string | undefined {
  return parseTlv(payload).find((field) => field.id === id)?.value;
}

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

    expect(valueOf(brCode({ ...base, amountCents: 0 }), '54')).toBeUndefined();
    expect(valueOf(brCode(base), '54')).toBeUndefined();
  });

  test('uses the given txid', () => {
    const code = brCode({ key: 'a@b.com', receiverName: 'X', city: 'Y', txid: 'ABC123' });

    expect(code).toContain('62100506ABC123');
  });

  test('maps ordinal indicators to letters', () => {
    const code = brCode({ key: 'a@b.com', receiverName: 'Bloco Nº2', city: 'Vª' });

    expect(code).toContain('5909Bloco No2');
    expect(valueOf(code, '59')).toBe('Bloco No2');
    expect(valueOf(code, '60')).toBe('Va');
  });

  test('drops characters outside printable ASCII, collapses spaces and keeps TLV lengths consistent', () => {
    const code = brCode({
      key: 'a@b.com',
      receiverName: '  Morada 😀  ø  Bloco ',
      city: 'São   Paulo',
      amountCents: 100,
    });

    expect(valueOf(code, '59')).toBe('Morada Bloco');
    expect(valueOf(code, '60')).toBe('Sao Paulo');
    expect(parseTlv(code).map((field) => field.id)).toContain('63');
    expect(/^[\x20-\x7E]+$/.test(code)).toBe(true);
  });

  test('truncates the sanitized name to 25 and city to 15 characters', () => {
    const code = brCode({
      key: 'a@b.com',
      receiverName: `😀${'N'.repeat(30)}`,
      city: 'C'.repeat(20),
    });

    expect(valueOf(code, '59')).toBe('N'.repeat(25));
    expect(valueOf(code, '60')).toBe('C'.repeat(15));
  });

  test('throws when the key or txid has non-ASCII characters', () => {
    expect(() => brCode({ key: 'á@b.com', receiverName: 'X', city: 'Y' })).toThrow();
    expect(() => brCode({ key: 'a@b.com', receiverName: 'X', city: 'Y', txid: 'é' })).toThrow();
  });

  test('throws when a field value exceeds 99 characters', () => {
    expect(() => brCode({ key: 'a'.repeat(100), receiverName: 'X', city: 'Y' })).toThrow();
  });
});
