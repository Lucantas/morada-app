import type { Receipt } from '../domain/receipt';

import { pendingReceipt } from './pending-receipt';

const build = (over: Partial<Receipt>): Receipt => ({
  id: 'x',
  ref: '2024-01',
  title: 'Boleto',
  dueLabel: '10/01',
  valueCents: 1000,
  status: 'pago',
  ...over,
});

describe('pendingReceipt', () => {
  test('returns the first pendente receipt', () => {
    const first = build({ id: 'a', status: 'pendente' });
    const second = build({ id: 'b', status: 'pendente' });
    expect(pendingReceipt([build({ id: 'z' }), first, second])).toEqual(first);
  });

  test('returns null when none are pendente', () => {
    expect(pendingReceipt([build({ id: 'a' }), build({ id: 'b' })])).toBeNull();
  });

  test('returns null for an empty list', () => {
    expect(pendingReceipt([])).toBeNull();
  });
});
