import { dueDateFromRef } from './due-date';

describe('dueDateFromRef', () => {
  test('derives an ISO due date from MM/AAAA and the due day', () => {
    expect(dueDateFromRef('04/2026', 15)).toBe('2026-04-15');
    expect(dueDateFromRef('12/2026', 5)).toBe('2026-12-05');
  });

  test('zero-pads month and day', () => {
    expect(dueDateFromRef('4/2026', 9)).toBe('2026-04-09');
  });

  test('returns null for non MM/AAAA input', () => {
    expect(dueDateFromRef('Água 04/2026', 15)).toBeNull();
    expect(dueDateFromRef('2026-04', 15)).toBeNull();
    expect(dueDateFromRef('', 15)).toBeNull();
  });

  test('returns null for an out-of-range month', () => {
    expect(dueDateFromRef('13/2026', 15)).toBeNull();
    expect(dueDateFromRef('00/2026', 15)).toBeNull();
  });
});
