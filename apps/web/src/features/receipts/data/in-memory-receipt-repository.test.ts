import { buildReceipt } from '@/test/factories.receipts';

import { InMemoryReceiptRepository } from './in-memory-receipt-repository';

describe('InMemoryReceiptRepository', () => {
  test('lists seeded receipts in insertion order', async () => {
    const repo = new InMemoryReceiptRepository([
      buildReceipt({ id: 'a', ref: '04/2026' }),
      buildReceipt({ id: 'b', ref: '03/2026' }),
    ]);

    expect((await repo.list()).map((r) => r.id)).toEqual(['a', 'b']);
  });

  test('save upserts and getById returns it', async () => {
    const repo = new InMemoryReceiptRepository([]);
    const receipt = buildReceipt({ id: 'x', status: 'pago', method: 'pix' });

    await repo.save(receipt);

    expect(await repo.getById('x')).toEqual(receipt);
  });

  test('save does not mutate the previously returned list', async () => {
    const repo = new InMemoryReceiptRepository([buildReceipt({ id: 'a' })]);
    const before = await repo.list();

    await repo.save(buildReceipt({ id: 'b' }));

    expect(before).toHaveLength(1);
  });

  test('listByApartment returns only the given apartment ledger', async () => {
    const repo = new InMemoryReceiptRepository([
      buildReceipt({ id: 'a', apartmentId: 'apt-1' }),
      buildReceipt({ id: 'b', apartmentId: 'apt-2' }),
      buildReceipt({ id: 'c', apartmentId: 'apt-1' }),
    ]);

    expect((await repo.listByApartment('apt-1')).map((r) => r.id).sort()).toEqual(['a', 'c']);
  });

  test('rejects malformed seed data at the boundary', () => {
    expect(() => new InMemoryReceiptRepository([{ id: 'a', ref: 'X' }])).toThrow();
  });

  test('archive removes the receipt from every read', async () => {
    const repo = new InMemoryReceiptRepository([buildReceipt({ id: 'a' })]);

    await repo.archive('a');

    expect(await repo.getById('a')).toBeNull();
    expect(await repo.list()).toEqual([]);
  });
});
