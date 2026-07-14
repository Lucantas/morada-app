import { formatIsoDate } from './dates';

describe('formatIsoDate', () => {
  test('formats an ISO date as DD/MM/YYYY', () => {
    expect(formatIsoDate('2026-05-10')).toBe('10/05/2026');
  });
});
