import { maskPhone } from './phone';

describe('maskPhone', () => {
  test('formats a full mobile number as (DD) NNNNN-NNNN', () => {
    expect(maskPhone('11900000000')).toBe('(11) 90000-0000');
  });

  test('formats a landline as (DD) NNNN-NNNN', () => {
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
  });

  test('masks progressively as digits are typed', () => {
    expect(maskPhone('1')).toBe('(1');
    expect(maskPhone('119')).toBe('(11) 9');
    expect(maskPhone('11900')).toBe('(11) 900');
  });

  test('ignores non-digits and caps at 11 digits', () => {
    expect(maskPhone('(11) 90000-0000 999')).toBe('(11) 90000-0000');
    expect(maskPhone('abc')).toBe('');
  });
});
