import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

import { listAccounts } from './list-accounts';

function fakeRepo(list: Account[]): AccountRepository {
  const map = new Map(list.map((a) => [a.id, a]));
  return {
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (a) => {
      map.set(a.id, a);
      return a;
    },
    archive: async (id) => {
      map.delete(id);
    },
  };
}

const build = (over: Partial<Account>): Account => ({
  id: 'x',
  description: 'Conta',
  category: 'Geral',
  date: '2026-04-05',
  valueCents: 1000,
  status: 'pendente',
  ...over,
});

describe('listAccounts', () => {
  test('returns accounts in insertion order', async () => {
    const repo = fakeRepo([
      build({ id: 'b', description: 'Bruno' }),
      build({ id: 'a', description: 'Ana' }),
      build({ id: 'c', description: 'Carla' }),
    ]);
    expect((await listAccounts(repo)).map((a) => a.description)).toEqual(['Bruno', 'Ana', 'Carla']);
  });
});
