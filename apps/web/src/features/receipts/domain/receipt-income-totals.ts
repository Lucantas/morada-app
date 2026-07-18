import type { Receipt } from './receipt';

export function paidReceiptMonthlyTotals(receipts: Receipt[]): Record<string, number> {
  return receipts.reduce<Record<string, number>>((totals, receipt) => {
    if (receipt.status !== 'pago' || !receipt.paidAt) {
      return totals;
    }

    const month = receipt.paidAt.slice(0, 7);
    return {
      ...totals,
      [month]: (totals[month] ?? 0) + receipt.valueCents,
    };
  }, {});
}

export function mergeMonthlyTotals(...totals: Record<string, number>[]): Record<string, number> {
  return totals.reduce<Record<string, number>>((merged, current) => {
    for (const [month, value] of Object.entries(current)) {
      merged = { ...merged, [month]: (merged[month] ?? 0) + value };
    }
    return merged;
  }, {});
}
