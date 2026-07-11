import { buildNotice } from '@/test/factories.notices';

import { activeNotices, noticeCount } from './active-notices';

describe('activeNotices', () => {
  test('keeps only notices that are not dismissed', () => {
    const active = buildNotice({ id: 'n-1', dismissed: false });
    const result = activeNotices([
      active,
      buildNotice({ id: 'n-2', dismissed: true }),
      buildNotice({ id: 'n-3', dismissed: false }),
    ]);

    expect(result.map((n) => n.id)).toEqual(['n-1', 'n-3']);
  });

  test('returns an empty array when all notices are dismissed', () => {
    expect(activeNotices([buildNotice({ dismissed: true })])).toEqual([]);
  });
});

describe('noticeCount', () => {
  test('counts only the active notices', () => {
    const result = noticeCount([
      buildNotice({ dismissed: false }),
      buildNotice({ dismissed: true }),
      buildNotice({ dismissed: false }),
    ]);

    expect(result).toBe(2);
  });
});
