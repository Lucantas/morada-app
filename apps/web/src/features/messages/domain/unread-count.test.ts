import { buildThread } from '@/test/factories.messages';

import { unreadCount } from './unread-count';

describe('unreadCount', () => {
  test('counts only threads flagged as unread', () => {
    const threads = [
      buildThread({ unread: true }),
      buildThread({ unread: false }),
      buildThread({ unread: true }),
    ];

    expect(unreadCount(threads)).toBe(2);
  });

  test('returns zero for an empty list', () => {
    expect(unreadCount([])).toBe(0);
  });
});
