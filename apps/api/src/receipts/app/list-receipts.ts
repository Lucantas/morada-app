import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { sortReceiptsByRecencyDesc } from '../domain/sort-receipts';

export async function listReceipts(repo: ReceiptRepository): Promise<Receipt[]> {
  return sortReceiptsByRecencyDesc(await repo.list());
}
