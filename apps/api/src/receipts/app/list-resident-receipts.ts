import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function listResidentReceipts(
  repo: ReceiptRepository,
  residentId: string,
): Promise<Receipt[]> {
  return [...(await repo.listByResident(residentId))].sort((a, b) =>
    a.ref.localeCompare(b.ref, 'pt-BR'),
  );
}
