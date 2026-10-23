import { NoticeNotFoundError } from '../domain/errors';
import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { removeNotice } from './remove-notice';

function repoWith(notices: Notice[]) {
  const removed: string[] = [];
  const repo: Pick<NoticeRepository, 'getById' | 'remove'> = {
    getById: async (id) => notices.find((n) => n.id === id) ?? null,
    remove: async (id) => {
      removed.push(id);
    },
  };
  return { repo: repo as NoticeRepository, removed };
}

const NOTICE: Notice = {
  id: 'n-1',
  title: 'Aviso',
  body: 'Corpo',
  dateLabel: '1 jul',
  kind: 'aviso',
  audience: 'Todos',
  dismissed: false,
};

describe('removeNotice', () => {
  test('removes an existing notice', async () => {
    const { repo, removed } = repoWith([NOTICE]);

    await removeNotice(repo, 'n-1');

    expect(removed).toEqual(['n-1']);
  });

  test('throws NoticeNotFoundError and removes nothing for an unknown id', async () => {
    const { repo, removed } = repoWith([NOTICE]);

    await expect(removeNotice(repo, 'n-x')).rejects.toThrow(NoticeNotFoundError);
    expect(removed).toEqual([]);
  });
});
