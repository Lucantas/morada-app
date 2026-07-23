import { maskCompetence } from './competence';

describe('maskCompetence', () => {
  test('returns empty string for empty input', () => {
    expect(maskCompetence('')).toBe('');
  });

  test('returns a single digit as-is', () => {
    expect(maskCompetence('6')).toBe('6');
  });

  test('returns two digits as-is', () => {
    expect(maskCompetence('06')).toBe('06');
  });

  test('inserts a slash once the third digit is typed', () => {
    expect(maskCompetence('062')).toBe('06/2');
  });

  test('formats a full MM/YYYY competência', () => {
    expect(maskCompetence('062026')).toBe('06/2026');
  });

  test('truncates extra digits beyond MM/YYYY', () => {
    expect(maskCompetence('0620261')).toBe('06/2026');
  });

  test('is idempotent when re-masking already-masked input', () => {
    expect(maskCompetence('06/2026')).toBe('06/2026');
  });

  test('strips non-digit characters before masking', () => {
    expect(maskCompetence('ab06cd2026ef')).toBe('06/2026');
  });
});
