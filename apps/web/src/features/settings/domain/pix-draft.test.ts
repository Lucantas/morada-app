import { EMPTY_PIX_DRAFT, draftFromPix, pixUpdateFor } from './pix-draft';

const stored = {
  keyType: 'email' as const,
  key: 'a@b.com',
  receiverName: 'Morada',
  city: 'Sao Paulo',
};

describe('pixUpdateFor', () => {
  test('omits pix when nothing is stored and the draft is blank', () => {
    expect(pixUpdateFor(null, EMPTY_PIX_DRAFT)).toBeUndefined();
  });

  test('clears pix when something is stored and the draft is blank', () => {
    expect(pixUpdateFor(stored, EMPTY_PIX_DRAFT)).toBeNull();
  });

  test('omits pix when the draft equals the stored value', () => {
    expect(pixUpdateFor(stored, draftFromPix(stored))).toBeUndefined();
  });

  test('returns the normalized pix when the draft changed', () => {
    const result = pixUpdateFor(stored, { ...stored, key: ' NEW@B.com ' });

    expect(result).toEqual({ ...stored, key: 'new@b.com' });
  });

  test('throws the validation message for an invalid draft', () => {
    expect(() => pixUpdateFor(null, { ...stored, keyType: 'cpf', key: '123' })).toThrow(
      'Chave Pix inválida',
    );
  });
});
