import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { ReceiptNotFoundError, ReceiptValidationError } from '../domain/errors';

import { editReceipt } from './edit-receipt';

function fakeRepo(seed: Receipt[]): ReceiptRepository {
  let rows = [...seed];
  return {
    list: async () => rows,
    listByResident: async (rid) => rows.filter((r) => r.residentId === rid),
    listByApartment: async (aid) => rows.filter((r) => r.apartmentId === aid),
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    save: async (r) => {
      rows = [...rows.filter((x) => x.id !== r.id), r];
      return r;
    },
    archive: async (id) => {
      rows = rows.filter((x) => x.id !== id);
    },
    getProof: async () => null,
  };
}

const paid: Receipt = {
  id: 'rc-1',
  ref: '07/2026',
  title: 'Taxa condominial',
  dueDate: '2026-07-15',
  paidAt: '2026-07-10',
  valueCents: 15000,
  status: 'pago',
  method: 'pix',
  residentId: 'r-1',
  apartmentId: 'apt-1',
};

describe('editReceipt', () => {
  it('updates only ref/title/valueCents/dueDate and preserves status/paidAt/method/ids', async () => {
    const repo = fakeRepo([paid]);
    const updated = await editReceipt(repo, 'rc-1', {
      ref: '07/2026',
      title: 'Taxa condominial',
      valueCents: 16000,
      dueDate: '2026-07-20',
    });
    expect(updated).toMatchObject({
      id: 'rc-1',
      valueCents: 16000,
      dueDate: '2026-07-20',
      status: 'pago',
      paidAt: '2026-07-10',
      method: 'pix',
      residentId: 'r-1',
      apartmentId: 'apt-1',
    });
  });

  it('throws ReceiptNotFoundError for a missing id', async () => {
    const repo = fakeRepo([]);
    await expect(
      editReceipt(repo, 'nope', { ref: 'x', title: 'y', valueCents: 1, dueDate: '2026-07-20' }),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });

  it('throws ReceiptValidationError for invalid patch input', async () => {
    const repo = fakeRepo([paid]);
    await expect(
      editReceipt(repo, 'rc-1', { ref: '', title: 'y', valueCents: 1, dueDate: '2026-07-20' }),
    ).rejects.toBeInstanceOf(ReceiptValidationError);
  });

  it('does not mutate the loaded receipt object', async () => {
    const repo = fakeRepo([paid]);
    await editReceipt(repo, 'rc-1', {
      ref: '07/2026',
      title: 'Taxa condominial',
      valueCents: 16000,
      dueDate: '2026-07-20',
    });
    expect(paid.valueCents).toBe(15000);
  });

  it('updates paidAt on a paid receipt when supplied', async () => {
    const repo = fakeRepo([paid]);
    const updated = await editReceipt(repo, 'rc-1', {
      ref: '07/2026',
      title: 'Taxa condominial',
      valueCents: 15000,
      dueDate: '2026-07-15',
      paidAt: '2026-07-12',
    });
    expect(updated.paidAt).toBe('2026-07-12');
  });

  it('preserves the existing paidAt when omitted from the patch', async () => {
    const repo = fakeRepo([paid]);
    const updated = await editReceipt(repo, 'rc-1', {
      ref: '07/2026',
      title: 'Taxa condominial',
      valueCents: 15000,
      dueDate: '2026-07-15',
    });
    expect(updated.paidAt).toBe('2026-07-10');
  });
});
