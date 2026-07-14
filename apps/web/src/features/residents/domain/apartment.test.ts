import { apartmentLabel, apartmentNumber } from './apartment';

describe('apartmentNumber', () => {
  test('extracts the digits from an apartment label', () => {
    expect(apartmentNumber('Apto 302')).toBe('302');
    expect(apartmentNumber('302')).toBe('302');
    expect(apartmentNumber('')).toBe('');
  });
});

describe('apartmentLabel', () => {
  test('builds the "Apto NNN" label from a number, ignoring non-digits', () => {
    expect(apartmentLabel('302')).toBe('Apto 302');
    expect(apartmentLabel('30a2')).toBe('Apto 302');
  });

  test('is empty when there are no digits', () => {
    expect(apartmentLabel('abc')).toBe('');
  });
});
