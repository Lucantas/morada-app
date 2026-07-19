import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { dismissNotice } from './dismiss-notice';

function fakeRepo(list: Notice[]): NoticeRepository {
  const map = new Map(list.map((n) => [n.id, n]));
  const dismissals = new Set<string>();
  return {
    list: async (viewerResidentId) =>
      [...map.values()].map((n) => ({
        ...n,
        dismissed: viewerResidentId !== null && dismissals.has(`${n.id}:${viewerResidentId}`),
      })),
    getById: async (id) => map.get(id) ?? null,
    save: async (n) => {
      map.set(n.id, { ...n, dismissed: false });
      return { ...n, dismissed: false };
    },
    dismiss: async (noticeId, residentId) => {
      const notice = map.get(noticeId);
      if (!notice) throw new Error('not found');
      dismissals.add(`${noticeId}:${residentId}`);
      return { ...notice, dismissed: true };
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
  test('marks the notice as dismissed for the dismissing resident', async () => {
    const repo = fakeRepo([build({ id: 'n-1' })]);
    expect((await dismissNotice(repo, 'n-1', 'resident-a')).dismissed).toBe(true);
    expect((await repo.list('resident-a')).find((n) => n.id === 'n-1')?.dismissed).toBe(true);
  });

  test('does not dismiss the notice for other residents', async () => {
    const repo = fakeRepo([build({ id: 'n-1' })]);
    await dismissNotice(repo, 'n-1', 'resident-a');

    expect((await repo.list('resident-b')).find((n) => n.id === 'n-1')?.dismissed).toBe(false);
  });

  test('does not dismiss the notice for the admin view', async () => {
    const repo = fakeRepo([build({ id: 'n-1' })]);
    await dismissNotice(repo, 'n-1', 'resident-a');

    expect((await repo.list(null)).find((n) => n.id === 'n-1')?.dismissed).toBe(false);
  });

  test('throws with status 404 when the notice is missing', async () => {
    try {
      await dismissNotice(fakeRepo([]), 'nope', 'resident-a');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
