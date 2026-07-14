import { AccountValidationError } from '../domain/errors';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

import { getAccount } from './get-account';
import { saveAccount } from './save-account';

function fakeRepo(): AccountRepository {
  const map = new Map<string, Account>();
  return {
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (a) => {
      map.set(a.id, a);
      return a;
    },
  };
}

describe('saveAccount', () => {
  test('assigns an id when the draft has none', async () => {
    const repo = fakeRepo();
    const saved = await saveAccount(repo, {
      description: 'Energia',
      category: 'Utilidades',
      date: '2026-04-05',
      valueCents: 5000,
      status: 'pendente',
    });
    expect(saved.id).toMatch(/.+/);
    expect(await getAccount(repo, saved.id)).toEqual(saved);
  });

  test('keeps an existing id', async () => {
    const repo = fakeRepo();
    const saved = await saveAccount(repo, {
      id: 'a-1',
      description: 'Água',
      category: 'Utilidades',
      date: '2026-04-05',
      valueCents: 3000,
      status: 'pago',
    });
    expect(saved.id).toBe('a-1');
  });

  test('rejects an empty description', async () => {
    await expect(
      saveAccount(fakeRepo(), {
        description: '',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 3000,
        status: 'pendente',
      }),
    ).rejects.toThrow(AccountValidationError);
  });
});

describe('getAccount', () => {
  test('throws with status 404 when missing', async () => {
    try {
      await getAccount(fakeRepo(), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
