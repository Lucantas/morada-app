import { ReceiptNotFoundError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function getReceipt(repo: ReceiptRepository, id: string): Promise<Receipt> {
  const receipt = await repo.getById(id);
  if (!receipt) throw new ReceiptNotFoundError(id);
  return receipt;
}
