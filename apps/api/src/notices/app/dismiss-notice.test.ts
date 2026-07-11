import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { dismissNotice } from './dismiss-notice';

function fakeRepo(list: Notice[]): NoticeRepository {
  const map = new Map(list.map((n) => [n.id, n]));
  return {
    list: () => [...map.values()],
    getById: (id) => map.get(id) ?? null,
    save: (n) => {
      map.set(n.id, n);
      return n;
    },
    remove: (id) => {
      map.delete(id);
    },
  };
}

const build = (over: Partial<Notice>): Notice => ({
  id: 'n-1',
  title: 'Título',
  body: 'Mensagem',
  kind: 'aviso',
  audience: 'todos',
  dateLabel: 'Agora',
  dismissed: false,
  ...over,
});

describe('dismissNotice', () => {
  test('marks the notice as dismissed', () => {
    const repo = fakeRepo([build({ id: 'n-1' })]);
    expect(dismissNotice(repo, 'n-1').dismissed).toBe(true);
    expect(repo.getById('n-1')?.dismissed).toBe(true);
  });

  test('does not mutate the original notice', () => {
    const original = build({ id: 'n-1' });
    dismissNotice(fakeRepo([original]), 'n-1');
    expect(original.dismissed).toBe(false);
  });

  test('throws with status 404 when the notice is missing', () => {
    try {
      dismissNotice(fakeRepo([]), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
