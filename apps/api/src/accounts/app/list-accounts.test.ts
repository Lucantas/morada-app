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
    getProof: async () => null,
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
  test('returns accounts most recent first', async () => {
    const repo = fakeRepo([
      build({ id: 'b', description: 'Maio', date: '2026-05-10' }),
      build({ id: 'a', description: 'Julho', date: '2026-07-25' }),
      build({ id: 'c', description: 'Junho', date: '2026-06-01' }),
    ]);
    expect((await listAccounts(repo)).map((a) => a.description)).toEqual([
      'Julho',
      'Junho',
      'Maio',
    ]);
  });
});
