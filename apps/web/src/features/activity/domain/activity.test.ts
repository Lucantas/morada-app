import { formatActivityTime } from './activity';

describe('formatActivityTime', () => {
  test('formats as dd/mm HH:mm in local time with zero padding', () => {
    const iso = new Date(2026, 4, 3, 9, 5).toISOString();

    expect(formatActivityTime(iso)).toBe('03/05 09:05');
  });
});
