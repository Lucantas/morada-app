import type { Notice } from '../domain/notice';

import { activeNotices, noticeCount } from './active-notices';

const build = (over: Partial<Notice>): Notice => ({
  id: 'x',
  title: 'Título',
  body: 'Mensagem',
  kind: 'aviso',
  audience: 'todos',
  dateLabel: 'Agora',
  dismissed: false,
  ...over,
});

describe('activeNotices', () => {
  test('returns only notices that are not dismissed', () => {
    const notices = [
      build({ id: 'a', dismissed: false }),
      build({ id: 'b', dismissed: true }),
      build({ id: 'c', dismissed: false }),
    ];
    expect(activeNotices(notices).map((n) => n.id)).toEqual(['a', 'c']);
  });
});

describe('noticeCount', () => {
  test('counts only active notices', () => {
    const notices = [
      build({ id: 'a', dismissed: false }),
      build({ id: 'b', dismissed: true }),
      build({ id: 'c', dismissed: false }),
    ];
    expect(noticeCount(notices)).toBe(2);
  });

  test('is zero when every notice is dismissed', () => {
    expect(noticeCount([build({ dismissed: true })])).toBe(0);
  });
});
