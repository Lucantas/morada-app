import { AccountValidationError } from '../domain/errors';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

import { getAccount } from './get-account';
import { saveAccount } from './save-account';

function fakeRepo(): AccountRepository {
  const map = new Map<string, Account>();
  return {
    list: () => [...map.values()],
    getById: (id) => map.get(id) ?? null,
    save: (a) => {
      map.set(a.id, a);
      return a;
    },
  };
}

describe('saveAccount', () => {
  test('assigns an id when the draft has none', () => {
    const repo = fakeRepo();
    const saved = saveAccount(repo, {
      description: 'Energia',
      category: 'Utilidades',
      dateLabel: '2026-07-10',
      valueCents: 5000,
      status: 'pendente',
    });
    expect(saved.id).toMatch(/.+/);
    expect(getAccount(repo, saved.id)).toEqual(saved);
  });

  test('keeps an existing id', () => {
    const repo = fakeRepo();
    const saved = saveAccount(repo, {
      id: 'a-1',
      description: 'Água',
      category: 'Utilidades',
      dateLabel: '2026-07-10',
      valueCents: 3000,
      status: 'pago',
    });
    expect(saved.id).toBe('a-1');
  });

  test('rejects an empty description', () => {
    expect(() =>
      saveAccount(fakeRepo(), {
        description: '',
        category: 'Utilidades',
        dateLabel: '2026-07-10',
        valueCents: 3000,
        status: 'pendente',
      }),
    ).toThrow(AccountValidationError);
  });
});

describe('getAccount', () => {
  test('throws with status 404 when missing', () => {
    try {
      getAccount(fakeRepo(), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
