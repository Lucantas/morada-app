import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { getReceipt } from './get-receipt';

function fakeRepo(list: Receipt[]): ReceiptRepository {
  const map = new Map(list.map((r) => [r.id, r]));
  return {
    list: async () => [...map.values()],
    listByResident: async (rid) => [...map.values()].filter((r) => r.residentId === rid),
    listByApartment: async (aid) => [...map.values()].filter((r) => r.apartmentId === aid),
    getById: async (id) => map.get(id) ?? null,
    save: async (r) => {
      map.set(r.id, r);
      return r;
    },
  };
}

const receipt: Receipt = {
  id: 'r-1',
  ref: '2024-01',
  title: 'Boleto',
  dueDate: '2026-05-10',
  valueCents: 1000,
  status: 'pendente',
};

describe('getReceipt', () => {
  test('returns the receipt when present', async () => {
    expect(await getReceipt(fakeRepo([receipt]), 'r-1')).toEqual(receipt);
  });

  test('throws with status 404 when missing', async () => {
    try {
      await getReceipt(fakeRepo([]), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
