import { buildAccount } from '@/test/factories.accounts';

import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountNotFoundError } from './errors';
import { getAccount } from './get-account';

describe('getAccount', () => {
  test('returns the account when it exists', async () => {
    const account = buildAccount({ id: 'a-9', description: 'Água' });
    const repo = new InMemoryAccountRepository([account]);

    expect(await getAccount(repo, 'a-9')).toEqual(account);
  });

  test('throws AccountNotFoundError when missing', async () => {
    const repo = new InMemoryAccountRepository([]);

    await expect(getAccount(repo, 'nope')).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});
