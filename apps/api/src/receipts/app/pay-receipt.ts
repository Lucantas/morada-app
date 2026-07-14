import { PaymentError, ReceiptNotFoundError } from '../domain/errors';
import { isoDateSchema, receiptMethodSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Marks a receipt paid, recording the method and the date it was paid. `paidAt`
// lets the admin register a payment made on a specific (e.g. past) date; when
// omitted (a resident paying now), it defaults to today.
export async function payReceipt(
  repo: ReceiptRepository,
  id: string,
  method: unknown,
  paidAt?: unknown,
): Promise<Receipt> {
  const receipt = await repo.getById(id);
  if (!receipt) throw new ReceiptNotFoundError(id);

  const parsedMethod = receiptMethodSchema.safeParse(method);
  if (!parsedMethod.success) throw new PaymentError('Método de pagamento inválido');

  const parsedDate = paidAt === undefined ? undefined : isoDateSchema.safeParse(paidAt);
  if (parsedDate && !parsedDate.success) throw new PaymentError('Data de pagamento inválida');

  const paid: Receipt = {
    ...receipt,
    status: 'pago',
    method: parsedMethod.data,
    paidAt: parsedDate ? parsedDate.data : today(),
  };
  return repo.save(paid);
}
