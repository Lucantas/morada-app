import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export function listResidentReceipts(repo: ReceiptRepository, residentId: string): Receipt[] {
  return [...repo.listByResident(residentId)].sort((a, b) => a.ref.localeCompare(b.ref, 'pt-BR'));
}
