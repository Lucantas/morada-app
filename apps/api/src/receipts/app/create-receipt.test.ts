import { ChargeResidentNotFoundError, ReceiptValidationError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { createReceipt } from './create-receipt';

function fakeRepo(): ReceiptRepository & { saved: Receipt[] } {
  const saved: Receipt[] = [];
  return {
    saved,
    list: async () => saved,
    listByResident: async (rid) => saved.filter((r) => r.residentId === rid),
    listByApartment: async (aid) => saved.filter((r) => r.apartmentId === aid),
    getById: async (id) => saved.find((r) => r.id === id) ?? null,
    save: async (r) => {
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
  test('creates a pending receipt for the resident with a generated id', async () => {
    const repo = fakeRepo();
    const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), validInput);

    expect(receipt.id).toMatch(/.+/);
    expect(receipt.status).toBe('pendente');
    expect(receipt.residentId).toBe('r-1');
    expect(receipt.apartmentId).toBe('ap-1');
    expect(receipt.valueCents).toBe(45000);
    expect(await repo.getById(receipt.id)).toEqual(receipt);
  });

  test('rejects a charge for a resident that does not exist', async () => {
    await expect(createReceipt(fakeRepo(), async () => null, validInput)).rejects.toThrow(
      ChargeResidentNotFoundError,
    );
  });

  test('rejects invalid input', async () => {
    await expect(
      createReceipt(fakeRepo(), async () => ({ apartmentId: 'ap-1' }), { residentId: 'r-1' }),
    ).rejects.toThrow(ReceiptValidationError);
  });

  test('rejects a negative value', async () => {
    await expect(
      createReceipt(fakeRepo(), async () => ({ apartmentId: 'ap-1' }), {
        ...validInput,
        valueCents: -1,
      }),
    ).rejects.toThrow(ReceiptValidationError);
  });
});
