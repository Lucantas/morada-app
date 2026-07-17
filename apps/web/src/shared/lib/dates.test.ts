import { formatIsoDate, formatMonthName } from './dates';

describe('formatIsoDate', () => {
  test('formats an ISO date as DD/MM/YYYY', () => {
    expect(formatIsoDate('2026-05-10')).toBe('10/05/2026');
  });
});

describe('formatMonthName', () => {
  it.each([
    // 12 months in YYYY-MM format
    ['2026-01', 'janeiro'],
    ['2026-02', 'fevereiro'],
    ['2026-03', 'março'],
    ['2026-04', 'abril'],
    ['2026-05', 'maio'],
    ['2026-06', 'junho'],
    ['2026-07', 'julho'],
    ['2026-08', 'agosto'],
    ['2026-09', 'setembro'],
    ['2026-10', 'outubro'],
    ['2026-11', 'novembro'],
    ['2026-12', 'dezembro'],
    // 12 months in YYYY-MM-DD format
    ['2026-01-15', 'janeiro'],
    ['2026-02-28', 'fevereiro'],
    ['2026-03-10', 'março'],
    ['2026-04-20', 'abril'],
    ['2026-05-05', 'maio'],
    ['2026-06-30', 'junho'],
    ['2026-07-14', 'julho'],
    ['2026-08-25', 'agosto'],
    ['2026-09-01', 'setembro'],
    ['2026-10-31', 'outubro'],
    ['2026-11-11', 'novembro'],
    ['2026-12-24', 'dezembro'],
    // Invalid/out-of-range inputs should return empty string
    ['2026-13', ''],
    ['2026-00', ''],
    ['', ''],
    ['invalid', ''],
  ])('should format "%s" as "%s"', (input: string, expected: string) => {
    expect(formatMonthName(input)).toBe(expected);
  });
});
