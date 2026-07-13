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
  };
}

const build = (over: Partial<Receipt>): Receipt => ({
  id: 'x',
  ref: '2024-01',
  title: 'Boleto',
  dueLabel: '10/01',
  valueCents: 1000,
  status: 'pendente',
  ...over,
});

describe('listReceipts', () => {
  test('returns receipts sorted by ref', async () => {
    const repo = fakeRepo([
      build({ id: 'b', ref: '2024-03' }),
      build({ id: 'a', ref: '2024-01' }),
      build({ id: 'c', ref: '2024-02' }),
    ]);
    expect((await listReceipts(repo)).map((r) => r.ref)).toEqual(['2024-01', '2024-02', '2024-03']);
  });
});
