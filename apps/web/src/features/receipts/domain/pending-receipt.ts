import type { Receipt } from './receipt';

export function pendingReceipt(receipts: readonly Receipt[]): Receipt | null {
  return receipts.find((receipt) => receipt.status === 'pendente') ?? null;
}
