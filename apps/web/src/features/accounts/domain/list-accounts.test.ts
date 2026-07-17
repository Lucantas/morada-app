import { buildAccount } from '@/test/factories.accounts';

import type { Account } from './account';
import type { AccountRepository } from './account-repository';
import { listAccounts } from './list-accounts';

function fakeRepo(accounts: Account[]): AccountRepository {
  return {
    list: async () => accounts,
    getById: async (id) => accounts.find((a) => a.id === id) ?? null,
    save: async (a) => a,
    archive: async () => undefined,
  };
}

describe('listAccounts', () => {
  test('returns accounts preserving insertion order', async () => {
    const repo = fakeRepo([
      buildAccount({ id: 'a-3', description: 'Limpeza' }),
      buildAccount({ id: 'a-1', description: 'Água' }),
      buildAccount({ id: 'a-2', description: 'Energia' }),
    ]);

    const result = await listAccounts(repo);

    expect(result.map((a) => a.id)).toEqual(['a-3', 'a-1', 'a-2']);
  });

  test('returns an empty array when there are no accounts', async () => {
    expect(await listAccounts(fakeRepo([]))).toEqual([]);
  });
});
