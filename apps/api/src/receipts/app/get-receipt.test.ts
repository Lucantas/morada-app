import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { getReceipt } from './get-receipt';

function fakeRepo(list: Receipt[]): ReceiptRepository {
  const map = new Map(list.map((r) => [r.id, r]));
  return {
    list: () => [...map.values()],
    listByResident: (rid) => [...map.values()].filter((r) => r.residentId === rid),
    getById: (id) => map.get(id) ?? null,
    save: (r) => {
      map.set(r.id, r);
      return r;
    },
  };
}

const receipt: Receipt = {
  id: 'r-1',
  ref: '2024-01',
  title: 'Boleto',
  dueLabel: '10/01',
  valueCents: 1000,
  status: 'pendente',
};

describe('getReceipt', () => {
  test('returns the receipt when present', () => {
    expect(getReceipt(fakeRepo([receipt]), 'r-1')).toEqual(receipt);
  });

  test('throws with status 404 when missing', () => {
    try {
      getReceipt(fakeRepo([]), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
