import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { dismissNotice } from './dismiss-notice';

function fakeRepo(list: Notice[]): NoticeRepository {
  const map = new Map(list.map((n) => [n.id, n]));
  return {
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (n) => {
      map.set(n.id, n);
      return n;
    },
    remove: async (id) => {
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
  test('marks the notice as dismissed', async () => {
    const repo = fakeRepo([build({ id: 'n-1' })]);
    expect((await dismissNotice(repo, 'n-1')).dismissed).toBe(true);
    expect((await repo.getById('n-1'))?.dismissed).toBe(true);
  });

  test('does not mutate the original notice', async () => {
    const original = build({ id: 'n-1' });
    await dismissNotice(fakeRepo([original]), 'n-1');
    expect(original.dismissed).toBe(false);
  });

  test('throws with status 404 when the notice is missing', async () => {
    try {
      await dismissNotice(fakeRepo([]), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
