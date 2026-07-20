import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { sortReceiptsByRecencyDesc } from '../domain/sort-receipts';

export async function listApartmentReceipts(
  repo: ReceiptRepository,
  apartmentId: string,
): Promise<Receipt[]> {
  return sortReceiptsByRecencyDesc(await repo.listByApartment(apartmentId));
}
