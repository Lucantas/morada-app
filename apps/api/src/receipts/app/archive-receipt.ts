import { ReceiptNotFoundError } from '../domain/errors';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function archiveReceipt(repo: ReceiptRepository, id: string): Promise<void> {
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  await repo.archive(id);
}
