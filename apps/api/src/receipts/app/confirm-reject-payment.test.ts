import { ReceiptNotFoundError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { confirmPayment } from './confirm-payment';
import { rejectPayment } from './reject-payment';

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

const analise: Receipt = {
  id: 'rc-1',
  ref: '07/2026',
  title: 'Taxa condominial',
  dueDate: '2026-07-15',
  valueCents: 15000,
  status: 'em_analise',
  method: 'pix',
  submittedAt: '2026-07-14',
  proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  residentId: 'r-1',
  apartmentId: 'apt-1',
};

describe('confirm/reject payment', () => {
  it('confirm sets pago with the given paidAt, keeping method', async () => {
    const repo = fakeRepo([analise]);
    const r = await confirmPayment(repo, 'rc-1', '2026-07-16');
    expect(r).toMatchObject({ status: 'pago', paidAt: '2026-07-16', method: 'pix' });
  });

  it('reject returns to pendente and clears proof/submittedAt/method/paidAt', async () => {
    const repo = fakeRepo([analise]);
    const r = await rejectPayment(repo, 'rc-1');
    expect(r.status).toBe('pendente');
    expect(r.proofDataUrl).toBeUndefined();
    expect(r.submittedAt).toBeUndefined();
    expect(r.method).toBeUndefined();
    expect(r.paidAt).toBeUndefined();
  });

  it('confirm rejects with ReceiptNotFoundError when the receipt does not exist', async () => {
    const repo = fakeRepo([]);
    await expect(confirmPayment(repo, 'nope', '2026-07-16')).rejects.toBeInstanceOf(
      ReceiptNotFoundError,
    );
  });

  it('reject rejects with ReceiptNotFoundError when the receipt does not exist', async () => {
    const repo = fakeRepo([]);
    await expect(rejectPayment(repo, 'nope')).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });
});
