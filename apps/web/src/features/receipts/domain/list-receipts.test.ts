import { buildReceipt } from '@/test/factories.receipts';

import { listReceipts } from './list-receipts';
import type { Receipt } from './receipt';
import type { ReceiptRepository } from './receipt-repository';

function fakeRepo(receipts: Receipt[]): ReceiptRepository {
  return {
    list: async () => receipts,
    listByApartment: async (aid) => receipts.filter((r) => r.apartmentId === aid),
    getById: async (id) => receipts.find((r) => r.id === id) ?? null,
    save: async (r) => r,
  };
}

describe('listReceipts', () => {
  test('returns receipts in insertion order', async () => {
    const repo = fakeRepo([
      buildReceipt({ ref: '04/2026' }),
      buildReceipt({ ref: '03/2026' }),
      buildReceipt({ ref: '02/2026' }),
    ]);

    const result = await listReceipts(repo);

    expect(result.map((r) => r.ref)).toEqual(['04/2026', '03/2026', '02/2026']);
  });

  test('returns an empty array when there are no receipts', async () => {
    expect(await listReceipts(fakeRepo([]))).toEqual([]);
  });
});
