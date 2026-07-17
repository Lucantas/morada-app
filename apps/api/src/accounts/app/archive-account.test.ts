import { AccountNotFoundError } from '../domain/errors';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

import { archiveAccount } from './archive-account';

function fakeRepo(list: Account[]): AccountRepository & { archived: string[] } {
  const map = new Map(list.map((a) => [a.id, a]));
  const archived: string[] = [];
  return {
    archived,
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (a) => {
      map.set(a.id, a);
      return a;
    },
    archive: async (id) => {
      archived.push(id);
      map.delete(id);
    },
  };
}

const account: Account = {
  id: 'a-1',
  description: 'Energia',
  category: 'Utilidades',
  date: '2026-04-05',
  valueCents: 5000,
  status: 'pendente',
};

describe('archiveAccount', () => {
  test('archives an existing account', async () => {
    const repo = fakeRepo([account]);

    await archiveAccount(repo, 'a-1');

    expect(repo.archived).toEqual(['a-1']);
    expect(await repo.getById('a-1')).toBeNull();
  });

  test('throws AccountNotFoundError for an unknown id', async () => {
    await expect(archiveAccount(fakeRepo([]), 'nope')).rejects.toThrow(AccountNotFoundError);
  });
});
