import { ReceiptNotFoundError } from '../domain/errors';
import { receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function rejectPayment(repo: ReceiptRepository, id: string): Promise<Receipt> {
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const { method, paidAt, submittedAt, proofDataUrl, ...rest } = existing;
  void method;
  void paidAt;
  void submittedAt;
  void proofDataUrl;
  const updated = receiptSchema.parse({ ...rest, status: 'pendente', proofDataUrl: null });
  return repo.save(updated);
}
