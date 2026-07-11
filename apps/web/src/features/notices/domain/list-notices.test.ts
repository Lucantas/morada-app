import { buildNotice } from '@/test/factories.notices';

import { listNotices } from './list-notices';
import type { Notice } from './notice';
import type { NoticeRepository } from './notice-repository';

function fakeRepo(notices: Notice[]): NoticeRepository {
  return {
    list: async () => notices,
    getById: async (id) => notices.find((n) => n.id === id) ?? null,
    save: async (n) => n,
    remove: async () => undefined,
  };
}

describe('listNotices', () => {
  test('returns notices in insertion order', async () => {
    const repo = fakeRepo([
      buildNotice({ title: 'A' }),
      buildNotice({ title: 'B' }),
      buildNotice({ title: 'C' }),
    ]);

    const result = await listNotices(repo);

    expect(result.map((n) => n.title)).toEqual(['A', 'B', 'C']);
  });

  test('returns an empty array when there are no notices', async () => {
    expect(await listNotices(fakeRepo([]))).toEqual([]);
  });
});
