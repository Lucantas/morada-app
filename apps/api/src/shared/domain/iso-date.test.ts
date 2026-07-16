import { isoDateSchema } from './iso-date';

describe('isoDateSchema', () => {
  test.each(['2026-05-10', '2024-02-29', '2026-12-31'])('accepts real date %s', (date) => {
    expect(isoDateSchema.parse(date)).toBe(date);
  });

  test.each(['2026-13-45', '2026-02-30', '2026-00-10', '2026-05-32', '2025-02-29'])(
    'rejects impossible date %s',
    (date) => {
      expect(isoDateSchema.safeParse(date).success).toBe(false);
    },
  );

  test.each(['2026-5-10', '10/05/2026', '2026-05-10T00:00', 'not-a-date'])(
    'rejects malformed date %s',
    (date) => {
      expect(isoDateSchema.safeParse(date).success).toBe(false);
    },
  );
});
