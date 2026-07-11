import type { Receipt } from '../domain/receipt';

export function pendingReceipt(receipts: Receipt[]): Receipt | null {
  return receipts.find((receipt) => receipt.status === 'pendente') ?? null;
}
