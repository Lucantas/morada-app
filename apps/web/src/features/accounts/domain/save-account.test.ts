import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountValidationError } from './errors';
import { saveAccount } from './save-account';

describe('saveAccount', () => {
  test('assigns an id when the draft has none', async () => {
    const repo = new InMemoryAccountRepository([]);

    const saved = await saveAccount(repo, {
      description: 'Água — abril',
      category: 'Utilidades',
      date: '2026-04-05',
      valueCents: 124000,
      status: 'pago',
    });

    expect(saved.id).toMatch(/.+/);
    expect(await repo.getById(saved.id)).toEqual(saved);
  });

  test('keeps the id when editing an existing account', async () => {
    const repo = new InMemoryAccountRepository([]);

    const saved = await saveAccount(repo, {
      id: 'a-1',
      description: 'Energia',
      category: 'Utilidades',
      date: '2026-04-05',
      valueCents: 89000,
      status: 'pendente',
    });

    expect(saved.id).toBe('a-1');
  });

  test('rejects a draft with an empty description', async () => {
    const repo = new InMemoryAccountRepository([]);

    await expect(
      saveAccount(repo, {
        description: '',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 124000,
        status: 'pago',
      }),
    ).rejects.toBeInstanceOf(AccountValidationError);
  });

  test('persists an optional due date and rejects a malformed one', async () => {
    const repo = new InMemoryAccountRepository([]);
    const base = {
      description: 'Água',
      category: 'Utilidades',
      date: '2026-04-05',
      valueCents: 1000,
      status: 'pendente' as const,
    };

    const saved = await saveAccount(repo, { ...base, dueDate: '2026-05-10' });

    expect(saved.dueDate).toBe('2026-05-10');
    await expect(saveAccount(repo, { ...base, dueDate: '10/05/2026' })).rejects.toBeInstanceOf(
      AccountValidationError,
    );
  });
});
