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
    archive: async (id) => {
      const index = saved.findIndex((r) => r.id === id);
      if (index !== -1) saved.splice(index, 1);
    },
  };
}

const validInput = {
  residentId: 'r-1',
  ref: '05/2026',
  title: 'Taxa condominial',
  valueCents: 45000,
  dueDate: '2026-05-10',
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

  test('registers a receipt already paid when paidAt and method are given', async () => {
    const repo = fakeRepo();
    const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), {
      residentId: 'r-1',
      ref: '06/2026',
      title: 'Taxa condominial',
      valueCents: 15000,
      dueDate: '2026-06-15',
      paidAt: '2026-06-14',
      method: 'dinheiro',
    });
    expect(receipt).toMatchObject({ status: 'pago', paidAt: '2026-06-14', method: 'dinheiro' });
  });

  test('creates a pending receipt when paidAt/method are omitted', async () => {
    const repo = fakeRepo();
    const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), validInput);
    expect(receipt.status).toBe('pendente');
    expect(receipt.paidAt).toBeUndefined();
    expect(receipt.method).toBeUndefined();
  });

  test('stays pending when paidAt is given but method is omitted', async () => {
    const repo = fakeRepo();
    const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), {
      ...validInput,
      paidAt: '2026-05-09',
    });
    expect(receipt.status).toBe('pendente');
    expect(receipt.paidAt).toBeUndefined();
    expect(receipt.method).toBeUndefined();
  });

  test('persists the proof when creating an already-paid receipt with a proofDataUrl', async () => {
    const repo = fakeRepo();
    const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), {
      residentId: 'r-1',
      ref: '06/2026',
      title: 'Taxa condominial',
      valueCents: 15000,
      dueDate: '2026-06-15',
      paidAt: '2026-06-14',
      method: 'dinheiro',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(receipt).toMatchObject({
      status: 'pago',
      method: 'dinheiro',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
  });

  test('ignores proofDataUrl when the receipt is created pending', async () => {
    const repo = fakeRepo();
    const receipt = await createReceipt(repo, async () => ({ apartmentId: 'ap-1' }), {
      ...validInput,
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(receipt.status).toBe('pendente');
    expect(receipt.proofDataUrl).toBeUndefined();
  });

  test('rejects a malformed proofDataUrl when creating an already-paid receipt', async () => {
    await expect(
      createReceipt(fakeRepo(), async () => ({ apartmentId: 'ap-1' }), {
        residentId: 'r-1',
        ref: '06/2026',
        title: 'Taxa condominial',
        valueCents: 15000,
        dueDate: '2026-06-15',
        paidAt: '2026-06-14',
        method: 'dinheiro',
        proofDataUrl: 'not-a-proof',
      }),
    ).rejects.toThrow(ReceiptValidationError);
  });
});
