import { buildReceipt } from '@/test/factories.receipts';

import { pendingReceipt } from './pending-receipt';

describe('pendingReceipt', () => {
  test('returns the first pending receipt', async () => {
    const first = buildReceipt({ id: 'rc-1', status: 'pendente' });
    const result = pendingReceipt([
      buildReceipt({ id: 'rc-0', status: 'pago', method: 'pix' }),
      first,
      buildReceipt({ id: 'rc-2', status: 'pendente' }),
    ]);

    expect(result).toBe(first);
  });

  test('returns null when there is no pending receipt', async () => {
    const result = pendingReceipt([
      buildReceipt({ id: 'rc-1', status: 'pago', method: 'pix' }),
      buildReceipt({ id: 'rc-2', status: 'pago', method: 'dinheiro' }),
    ]);

    expect(result).toBeNull();
  });
});
