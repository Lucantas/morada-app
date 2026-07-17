import { PaymentError, ReceiptNotFoundError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { payReceipt } from './pay-receipt';

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

const pending: Receipt = {
  id: 'r-1',
  ref: '2024-01',
  title: 'Boleto',
  dueDate: '2026-05-10',
  valueCents: 1000,
  status: 'pendente',
};

describe('payReceipt', () => {
  test('marks the receipt as pago and sets the method', async () => {
    const repo = fakeRepo([pending]);
    const paid = await payReceipt(repo, 'r-1', 'pix');
    expect(paid.status).toBe('pago');
    expect(paid.method).toBe('pix');
    expect(await repo.getById('r-1')).toEqual(paid);
  });

  test('does not mutate the original receipt', async () => {
    const repo = fakeRepo([pending]);
    await payReceipt(repo, 'r-1', 'dinheiro');
    expect(pending.status).toBe('pendente');
    expect(pending.method).toBeUndefined();
  });

  test('throws 404 when the receipt is missing', async () => {
    await expect(payReceipt(fakeRepo([]), 'nope', 'pix')).rejects.toThrow(ReceiptNotFoundError);
  });

  test('rejects an invalid method', async () => {
    await expect(payReceipt(fakeRepo([pending]), 'r-1', 'boleto')).rejects.toThrow(PaymentError);
  });

  test('records the given payment date (admin registering a past payment)', async () => {
    const repo = fakeRepo([pending]);
    const paid = await payReceipt(repo, 'r-1', 'pix', '2026-05-08');
    expect(paid.paidAt).toBe('2026-05-08');
  });

  test('defaults the payment date to today when none is given', async () => {
    const repo = fakeRepo([pending]);
    const paid = await payReceipt(repo, 'r-1', 'pix');
    expect(paid.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('rejects an invalid payment date', async () => {
    await expect(payReceipt(fakeRepo([pending]), 'r-1', 'pix', '10/05/2026')).rejects.toThrow(
      PaymentError,
    );
  });
});
