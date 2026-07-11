import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export function listReceipts(repo: ReceiptRepository): Receipt[] {
  return [...repo.list()].sort((a, b) => a.ref.localeCompare(b.ref, 'pt-BR'));
}
