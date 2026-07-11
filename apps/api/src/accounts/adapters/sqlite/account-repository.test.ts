import { createTestDb } from '../../../platform/db';

import { SqliteAccountRepository } from './account-repository';

describe('SqliteAccountRepository', () => {
  test('save then getById round-trips through SQLite', () => {
    const repo = new SqliteAccountRepository(createTestDb());
    const account = {
      id: 'a-1',
      description: 'Energia',
      category: 'Utilidades',
      dateLabel: '2026-07-10',
      valueCents: 5000,
      status: 'pendente' as const,
    };

    repo.save(account);

    expect(repo.getById('a-1')).toEqual(account);
  });

  test('save upserts on conflicting id', () => {
    const repo = new SqliteAccountRepository(createTestDb());
    repo.save({
      id: 'a-1',
      description: 'Energia',
      category: 'Utilidades',
      dateLabel: '2026-07-10',
      valueCents: 5000,
      status: 'pendente',
    });
    repo.save({
      id: 'a-1',
      description: 'Energia Elétrica',
      category: 'Utilidades',
      dateLabel: '2026-07-11',
      valueCents: 6000,
      status: 'pago',
    });

    expect(repo.list()).toHaveLength(1);
    expect(repo.getById('a-1')?.description).toBe('Energia Elétrica');
    expect(repo.getById('a-1')?.valueCents).toBe(6000);
  });

  test('getById returns null when missing', () => {
    expect(new SqliteAccountRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
