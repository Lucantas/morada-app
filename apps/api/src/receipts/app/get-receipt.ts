import { ReceiptNotFoundError } from '../domain/errors';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export function getReceipt(repo: ReceiptRepository, id: string): Receipt {
  const receipt = repo.getById(id);
  if (!receipt) throw new ReceiptNotFoundError(id);
  return receipt;
}
