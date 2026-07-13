import { PaymentError, ReceiptNotFoundError } from '../domain/errors';
import { receiptMethodSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function payReceipt(
  repo: ReceiptRepository,
  id: string,
  method: unknown,
): Promise<Receipt> {
  const receipt = await repo.getById(id);
  if (!receipt) throw new ReceiptNotFoundError(id);

  const parsed = receiptMethodSchema.safeParse(method);
  if (!parsed.success) throw new PaymentError('Método de pagamento inválido');

  const paid: Receipt = { ...receipt, status: 'pago', method: parsed.data };
  return repo.save(paid);
}
