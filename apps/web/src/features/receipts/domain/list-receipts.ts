import type { Receipt } from './receipt';
import type { ReceiptRepository } from './receipt-repository';

export async function listReceipts(repository: ReceiptRepository): Promise<Receipt[]> {
  return repository.list();
}
