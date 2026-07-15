import { ReceiptNotFoundError } from '../domain/errors';
import { isoDateSchema, receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function confirmPayment(
  repo: ReceiptRepository,
  id: string,
  paidAt: string,
): Promise<Receipt> {
  const when = isoDateSchema.parse(paidAt);
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const updated = receiptSchema.parse({ ...existing, status: 'pago', paidAt: when });
  return repo.save(updated);
}
