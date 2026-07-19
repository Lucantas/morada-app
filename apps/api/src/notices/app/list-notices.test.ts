import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { listNotices } from './list-notices';

function fakeRepo(list: Notice[]): NoticeRepository {
  const map = new Map(list.map((n) => [n.id, n]));
  return {
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (n) => {
      map.set(n.id, n);
      return n;
    },
    dismiss: async (id) => {
      const notice = map.get(id);
      if (!notice) throw new Error('not found');
      const dismissed = { ...notice, dismissed: true };
      map.set(id, dismissed);
      return dismissed;
    },
    remove: async (id) => {
      map.delete(id);
    },
  };
}

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

describe('listNotices', () => {
  test('returns every notice from the repository', async () => {
    const repo = fakeRepo([build({ id: 'a' }), build({ id: 'b' }), build({ id: 'c' })]);
    expect((await listNotices(repo, null)).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  test('returns an empty array when there are no notices', async () => {
    expect(await listNotices(fakeRepo([]), null)).toEqual([]);
  });

  test('passes the viewer resident id through to the repository', async () => {
    const repo = fakeRepo([build({ id: 'a' })]);
    const listSpy = jest.spyOn(repo, 'list');

    await listNotices(repo, 'resident-a');

    expect(listSpy).toHaveBeenCalledWith('resident-a');
  });
});
