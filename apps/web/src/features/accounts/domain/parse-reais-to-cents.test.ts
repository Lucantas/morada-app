import { parseReaisToCents } from './parse-reais-to-cents';

describe('parseReaisToCents', () => {
  test('parses reais with comma decimals to cents', () => {
    expect(parseReaisToCents('1240,50')).toBe(124050);
  });

  test('strips thousands dots', () => {
    expect(parseReaisToCents('1.240,00')).toBe(124000);
  });

  test('handles a plain integer amount', () => {
    expect(parseReaisToCents('300')).toBe(30000);
  });

  test('returns 0 for non-numeric input', () => {
    expect(parseReaisToCents('abc')).toBe(0);
  });

  test('returns 0 for an empty string', () => {
    expect(parseReaisToCents('')).toBe(0);
  });
});
