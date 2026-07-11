import { buildReceipt } from '@/test/factories.receipts';

import { InMemoryReceiptRepository } from '../data/in-memory-receipt-repository';

import { ReceiptNotFoundError } from './errors';
import { getReceipt } from './get-receipt';

describe('getReceipt', () => {
  test('returns the receipt when it exists', async () => {
    const receipt = buildReceipt({ id: 'rc-9', ref: '01/2026' });
    const repo = new InMemoryReceiptRepository([receipt]);

    expect(await getReceipt(repo, 'rc-9')).toEqual(receipt);
  });

  test('throws ReceiptNotFoundError when missing', async () => {
    const repo = new InMemoryReceiptRepository([]);

    await expect(getReceipt(repo, 'nope')).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });
});
