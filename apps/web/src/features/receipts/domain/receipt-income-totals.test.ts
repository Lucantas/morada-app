import type { Receipt } from './receipt';
import { mergeMonthlyTotals, paidReceiptMonthlyTotals } from './receipt-income-totals';

function receipt(overrides: Partial<Receipt>): Receipt {
  return {
    id: 'rc-1',
    ref: '07/2026',
    title: 'Taxa condominial',
    dueDate: '2026-07-15',
    valueCents: 15000,
    status: 'pago',
    paidAt: '2026-07-10',
    ...overrides,
  };
}

describe('paidReceiptMonthlyTotals', () => {
  test('sums paid receipts keyed by the payment month', () => {
    const receipts = [
      receipt({ id: 'a', paidAt: '2026-07-03', valueCents: 15000 }),
      receipt({ id: 'b', paidAt: '2026-07-28', valueCents: 15000 }),
      receipt({ id: 'c', paidAt: '2026-08-02', valueCents: 20000 }),
    ];

    expect(paidReceiptMonthlyTotals(receipts)).toEqual({
      '2026-07': 30000,
      '2026-08': 20000,
    });
  });

  test('ignores receipts that are not paid', () => {
    const receipts = [
      receipt({ id: 'a', status: 'pendente', paidAt: undefined, valueCents: 15000 }),
      receipt({ id: 'b', status: 'em_analise', paidAt: undefined, valueCents: 15000 }),
      receipt({ id: 'c', status: 'pago', paidAt: '2026-07-10', valueCents: 15000 }),
    ];

    expect(paidReceiptMonthlyTotals(receipts)).toEqual({ '2026-07': 15000 });
  });

  test('ignores paid receipts without a payment date', () => {
    const receipts = [receipt({ status: 'pago', paidAt: undefined })];

    expect(paidReceiptMonthlyTotals(receipts)).toEqual({});
  });

  test('returns an empty map for no receipts', () => {
    expect(paidReceiptMonthlyTotals([])).toEqual({});
  });
});

describe('mergeMonthlyTotals', () => {
  test('adds values for the same month across maps', () => {
    expect(mergeMonthlyTotals({ '2026-07': 30000, '2026-08': 15000 }, { '2026-07': 5000 })).toEqual(
      { '2026-07': 35000, '2026-08': 15000 },
    );
  });

  test('does not mutate its inputs', () => {
    const a = { '2026-07': 30000 };
    const b = { '2026-07': 5000 };

    mergeMonthlyTotals(a, b);

    expect(a).toEqual({ '2026-07': 30000 });
    expect(b).toEqual({ '2026-07': 5000 });
  });
});
