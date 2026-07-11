import { formatBRL, formatBRLShort } from './money';

describe('formatBRL', () => {
  test('formats cents with two decimals in pt-BR notation', () => {
    expect(formatBRL(1248000)).toBe('12.480,00');
  });

  test('formats sub-real amounts', () => {
    expect(formatBRL(75050)).toBe('750,50');
  });

  test('formats zero', () => {
    expect(formatBRL(0)).toBe('0,00');
  });
});

describe('formatBRLShort', () => {
  test('rounds to whole reais without decimals', () => {
    expect(formatBRLShort(124000)).toBe('1.240');
  });

  test('rounds half up', () => {
    expect(formatBRLShort(89050)).toBe('891');
  });
});
