import { buildReceipt } from '@/test/factories.receipts';

import { InMemoryReceiptRepository } from '../data/in-memory-receipt-repository';

import { ReceiptNotFoundError } from './errors';
import { payReceipt } from './pay-receipt';

describe('payReceipt', () => {
  test('marks the receipt as pago and sets the method', async () => {
    const repo = new InMemoryReceiptRepository([buildReceipt({ id: 'rc-1', status: 'pendente' })]);

    const paid = await payReceipt(repo, 'rc-1', 'pix');

    expect(paid.status).toBe('pago');
    expect(paid.method).toBe('pix');
    expect(await repo.getById('rc-1')).toEqual(paid);
  });

  test('does not mutate the original receipt', async () => {
    const original = buildReceipt({ id: 'rc-2', status: 'pendente' });
    const repo = new InMemoryReceiptRepository([original]);

    await payReceipt(repo, 'rc-2', 'boleto');

    expect(original.status).toBe('pendente');
    expect(original.method).toBeUndefined();
  });

  test('throws when the receipt is missing', async () => {
    const repo = new InMemoryReceiptRepository([]);

    await expect(payReceipt(repo, 'nope', 'cartao')).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });
});
