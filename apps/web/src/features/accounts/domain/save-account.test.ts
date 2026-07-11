import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountValidationError } from './errors';
import { saveAccount } from './save-account';

describe('saveAccount', () => {
  test('assigns an id when the draft has none', async () => {
    const repo = new InMemoryAccountRepository([]);

    const saved = await saveAccount(repo, {
      description: 'Água — abril',
      category: 'Utilidades',
      dateLabel: '05/04',
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
      dateLabel: '03/04',
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
        dateLabel: '05/04',
        valueCents: 124000,
        status: 'pago',
      }),
    ).rejects.toBeInstanceOf(AccountValidationError);
  });
});
