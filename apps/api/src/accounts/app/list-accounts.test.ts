import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

import { listAccounts } from './list-accounts';

function fakeRepo(list: Account[]): AccountRepository {
  const map = new Map(list.map((a) => [a.id, a]));
  return {
    list: () => [...map.values()],
    getById: (id) => map.get(id) ?? null,
    save: (a) => {
      map.set(a.id, a);
      return a;
    },
  };
}

const build = (over: Partial<Account>): Account => ({
  id: 'x',
  description: 'Conta',
  category: 'Geral',
  dateLabel: '2026-07-10',
  valueCents: 1000,
  status: 'pendente',
  ...over,
});

describe('listAccounts', () => {
  test('returns accounts in insertion order', () => {
    const repo = fakeRepo([
      build({ id: 'b', description: 'Bruno' }),
      build({ id: 'a', description: 'Ana' }),
      build({ id: 'c', description: 'Carla' }),
    ]);
    expect(listAccounts(repo).map((a) => a.description)).toEqual(['Bruno', 'Ana', 'Carla']);
  });
});
