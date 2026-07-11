import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { listNotices } from './list-notices';

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
  test('returns every notice from the repository', () => {
    const repo = fakeRepo([build({ id: 'a' }), build({ id: 'b' }), build({ id: 'c' })]);
    expect(listNotices(repo).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  test('returns an empty array when there are no notices', () => {
    expect(listNotices(fakeRepo([]))).toEqual([]);
  });
});
