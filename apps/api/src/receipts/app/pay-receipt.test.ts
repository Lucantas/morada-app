import { PaymentError, ReceiptNotFoundError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { payReceipt } from './pay-receipt';

function fakeRepo(list: Receipt[]): ReceiptRepository {
  const map = new Map(list.map((r) => [r.id, r]));
  return {
    list: () => [...map.values()],
    listByResident: (rid) => [...map.values()].filter((r) => r.residentId === rid),
    listByApartment: (aid) => [...map.values()].filter((r) => r.apartmentId === aid),
    getById: (id) => map.get(id) ?? null,
    save: (r) => {
      map.set(r.id, r);
      return r;
    },
  };
}

const pending: Receipt = {
  id: 'r-1',
  ref: '2024-01',
  title: 'Boleto',
  dueLabel: '10/01',
  valueCents: 1000,
  status: 'pendente',
};

describe('payReceipt', () => {
  test('marks the receipt as pago and sets the method', () => {
    const repo = fakeRepo([pending]);
    const paid = payReceipt(repo, 'r-1', 'pix');
    expect(paid.status).toBe('pago');
    expect(paid.method).toBe('pix');
    expect(repo.getById('r-1')).toEqual(paid);
  });

  test('does not mutate the original receipt', () => {
    const repo = fakeRepo([pending]);
    payReceipt(repo, 'r-1', 'boleto');
    expect(pending.status).toBe('pendente');
    expect(pending.method).toBeUndefined();
  });

  test('throws 404 when the receipt is missing', () => {
    expect(() => payReceipt(fakeRepo([]), 'nope', 'pix')).toThrow(ReceiptNotFoundError);
  });

  test('rejects an invalid method', () => {
    expect(() => payReceipt(fakeRepo([pending]), 'r-1', 'dinheiro')).toThrow(PaymentError);
  });
});
