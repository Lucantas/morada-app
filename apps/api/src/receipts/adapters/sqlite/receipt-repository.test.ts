import { createTestDb } from '../../../platform/db';

import { SqliteReceiptRepository } from './receipt-repository';

describe('SqliteReceiptRepository', () => {
  test('save then getById round-trips a receipt with a method', () => {
    const repo = new SqliteReceiptRepository(createTestDb());
    const receipt = {
      id: 'r-1',
      ref: '2024-01',
      title: 'Boleto',
      dueLabel: '10/01',
      valueCents: 1000,
      status: 'pago' as const,
      method: 'pix' as const,
    };

    repo.save(receipt);

    expect(repo.getById('r-1')).toEqual(receipt);
  });

  test('save then getById round-trips a receipt without a method (null coerced to undefined)', () => {
    const repo = new SqliteReceiptRepository(createTestDb());
    const receipt = {
      id: 'r-2',
      ref: '2024-02',
      title: 'Boleto',
      dueLabel: '10/02',
      valueCents: 2000,
      status: 'pendente' as const,
    };

    repo.save(receipt);

    const stored = repo.getById('r-2');
    expect(stored).toEqual(receipt);
    expect(stored?.method).toBeUndefined();
  });

  test('save upserts on conflicting id', () => {
    const repo = new SqliteReceiptRepository(createTestDb());
    repo.save({
      id: 'r-1',
      ref: '2024-01',
      title: 'Boleto',
      dueLabel: '10/01',
      valueCents: 1000,
      status: 'pendente',
    });
    repo.save({
      id: 'r-1',
      ref: '2024-01',
      title: 'Boleto',
      dueLabel: '10/01',
      valueCents: 1000,
      status: 'pago',
      method: 'cartao',
    });

    expect(repo.list()).toHaveLength(1);
    expect(repo.getById('r-1')?.status).toBe('pago');
    expect(repo.getById('r-1')?.method).toBe('cartao');
  });

  test('getById returns null when missing', () => {
    expect(new SqliteReceiptRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
