import { ChargeResidentNotFoundError, ReceiptValidationError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { createReceipt } from './create-receipt';

function fakeRepo(): ReceiptRepository & { saved: Receipt[] } {
  const saved: Receipt[] = [];
  return {
    saved,
    list: () => saved,
    listByResident: (rid) => saved.filter((r) => r.residentId === rid),
    listByApartment: (aid) => saved.filter((r) => r.apartmentId === aid),
    getById: (id) => saved.find((r) => r.id === id) ?? null,
    save: (r) => {
      saved.push(r);
      return r;
    },
  };
}

const validInput = {
  residentId: 'r-1',
  ref: '05/2026',
  title: 'Taxa condominial',
  valueCents: 45000,
  dueLabel: 'Venc. 10/05/2026',
};

describe('createReceipt', () => {
  test('creates a pending receipt for the resident with a generated id', () => {
    const repo = fakeRepo();
    const receipt = createReceipt(repo, () => ({ apartmentId: 'ap-1' }), validInput);

    expect(receipt.id).toMatch(/.+/);
    expect(receipt.status).toBe('pendente');
    expect(receipt.residentId).toBe('r-1');
    expect(receipt.apartmentId).toBe('ap-1');
    expect(receipt.valueCents).toBe(45000);
    expect(repo.getById(receipt.id)).toEqual(receipt);
  });

  test('rejects a charge for a resident that does not exist', () => {
    expect(() => createReceipt(fakeRepo(), () => null, validInput)).toThrow(
      ChargeResidentNotFoundError,
    );
  });

  test('rejects invalid input', () => {
    expect(() =>
      createReceipt(fakeRepo(), () => ({ apartmentId: 'ap-1' }), { residentId: 'r-1' }),
    ).toThrow(ReceiptValidationError);
  });

  test('rejects a negative value', () => {
    expect(() =>
      createReceipt(fakeRepo(), () => ({ apartmentId: 'ap-1' }), { ...validInput, valueCents: -1 }),
    ).toThrow(ReceiptValidationError);
  });
});
