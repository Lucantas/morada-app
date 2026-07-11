import { getReceipt } from './get-receipt';
import type { Receipt, ReceiptMethod } from './receipt';
import type { ReceiptRepository } from './receipt-repository';

export async function payReceipt(
  repository: ReceiptRepository,
  id: string,
  method: ReceiptMethod,
): Promise<Receipt> {
  const receipt = await getReceipt(repository, id);
  const paid: Receipt = { ...receipt, status: 'pago', method };
  return repository.save(paid);
}
