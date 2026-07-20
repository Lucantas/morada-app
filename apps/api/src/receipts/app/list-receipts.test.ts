import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { listReceipts } from './list-receipts';

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
    archive: async (id) => {
      map.delete(id);
    },
  };
}

const build = (over: Partial<Receipt>): Receipt => ({
  id: 'x',
  ref: '01/2026',
  title: 'Boleto',
  dueDate: '2026-01-15',
  valueCents: 1000,
  status: 'pendente',
  ...over,
});

describe('listReceipts', () => {
  test('returns receipts most recent first', async () => {
    const repo = fakeRepo([
      build({ id: 'a', ref: '01/2026', dueDate: '2026-01-15' }),
      build({ id: 'c', ref: '11/2025', dueDate: '2025-11-15' }),
      build({ id: 'b', ref: '07/2026', dueDate: '2026-07-15' }),
    ]);
    expect((await listReceipts(repo)).map((r) => r.ref)).toEqual(['07/2026', '01/2026', '11/2025']);
  });
});
