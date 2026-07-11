import { receiptSchema, type Receipt } from '../domain/receipt';

export function toReceipt(raw: unknown): Receipt {
  return receiptSchema.parse(raw);
}
