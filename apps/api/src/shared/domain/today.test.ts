import { todayIn } from './today';

describe('todayIn', () => {
  test.each([
    ['2026-10-31T23:30:00Z', '2026-10-31'],
    ['2026-11-01T01:30:00Z', '2026-10-31'],
    ['2026-11-01T03:30:00Z', '2026-11-01'],
  ])('%s is %s in Brasília', (instant, expected) => {
    expect(todayIn(new Date(instant))).toBe(expected);
  });

  test('honours an explicit time zone', () => {
    expect(todayIn(new Date('2026-01-01T02:00:00Z'), 'UTC')).toBe('2026-01-01');
  });
});
