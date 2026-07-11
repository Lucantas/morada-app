import { ReceiptNotFoundError } from './errors';
import type { Receipt } from './receipt';
import type { ReceiptRepository } from './receipt-repository';

export async function getReceipt(repository: ReceiptRepository, id: string): Promise<Receipt> {
  const receipt = await repository.getById(id);
  if (!receipt) throw new ReceiptNotFoundError(id);
  return receipt;
}
