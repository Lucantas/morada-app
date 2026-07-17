import type { Receipt } from './receipt';

export function apartmentReceiptTotals(receipts: Receipt[]): {
  paidCents: number;
  openCents: number;
} {
  return receipts.reduce(
    (totals, receipt) =>
      receipt.status === 'pago'
        ? { ...totals, paidCents: totals.paidCents + receipt.valueCents }
        : { ...totals, openCents: totals.openCents + receipt.valueCents },
    { paidCents: 0, openCents: 0 },
  );
}
