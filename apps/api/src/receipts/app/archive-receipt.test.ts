import { ReceiptNotFoundError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { archiveReceipt } from './archive-receipt';

function fakeRepo(list: Receipt[]): ReceiptRepository & { archived: string[] } {
  const map = new Map(list.map((r) => [r.id, r]));
  const archived: string[] = [];
  return {
    archived,
    list: async () => [...map.values()],
    listByResident: async (rid) => [...map.values()].filter((r) => r.residentId === rid),
    listByApartment: async (aid) => [...map.values()].filter((r) => r.apartmentId === aid),
    getById: async (id) => map.get(id) ?? null,
    save: async (r) => {
      map.set(r.id, r);
      return r;
    },
    archive: async (id) => {
      archived.push(id);
      map.delete(id);
    },
  };
}

const pending: Receipt = {
  id: 'r-1',
  ref: '2024-01',
  title: 'Boleto',
  dueDate: '2026-05-10',
  valueCents: 1000,
  status: 'pendente',
};

describe('archiveReceipt', () => {
  test('archives an existing receipt', async () => {
    const repo = fakeRepo([pending]);

    await archiveReceipt(repo, 'r-1');

    expect(repo.archived).toEqual(['r-1']);
    expect(await repo.getById('r-1')).toBeNull();
  });

  test('throws ReceiptNotFoundError for an unknown id', async () => {
    await expect(archiveReceipt(fakeRepo([]), 'nope')).rejects.toThrow(ReceiptNotFoundError);
  });
});
