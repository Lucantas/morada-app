import { generateTempPassword } from './temp-password';

describe('generateTempPassword', () => {
  test('returns a 10-character password by default', () => {
    expect(generateTempPassword()).toHaveLength(10);
  });

  test('uses only the unambiguous safe charset', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTempPassword()).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]+$/);
    }
  });

  test('produces a different password on each call', () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(seen.size).toBe(20);
  });
});
