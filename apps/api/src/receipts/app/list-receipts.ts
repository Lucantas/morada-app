import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function listReceipts(repo: ReceiptRepository): Promise<Receipt[]> {
  return [...(await repo.list())].sort((a, b) => a.ref.localeCompare(b.ref, 'pt-BR'));
}
