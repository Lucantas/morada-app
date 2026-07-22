import { ReceiptNotFoundError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { submitPayment } from './submit-payment';

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

const pending: Receipt = {
  id: 'rc-1',
  ref: '07/2026',
  title: 'Taxa condominial',
  dueDate: '2026-07-15',
  valueCents: 15000,
  status: 'pendente',
  residentId: 'r-1',
  apartmentId: 'apt-1',
};

describe('submitPayment', () => {
  it('moves a pending receipt to em_analise with method, proof and submittedAt', async () => {
    const repo = fakeRepo([pending]);
    const result = await submitPayment(repo, 'rc-1', {
      method: 'pix',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      today: '2026-07-14',
    });
    expect(result).toMatchObject({
      id: 'rc-1',
      status: 'em_analise',
      method: 'pix',
      submittedAt: '2026-07-14',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
  });

  it('rejects an invalid proof mime', async () => {
    const repo = fakeRepo([pending]);
    await expect(
      submitPayment(repo, 'rc-1', {
        method: 'pix',
        proofDataUrl: 'data:text/plain;base64,aaa',
        today: '2026-07-14',
      }),
    ).rejects.toBeTruthy();
  });

  it('rejects with ReceiptNotFoundError when the receipt does not exist', async () => {
    const repo = fakeRepo([]);
    await expect(
      submitPayment(repo, 'nope', {
        method: 'pix',
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        today: '2026-07-14',
      }),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });
});
