import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { toReceipt } from './receipt-row';

export class InMemoryReceiptRepository implements ReceiptRepository {
  private receipts: Map<string, Receipt>;

  constructor(seed: readonly unknown[] = []) {
    this.receipts = new Map(seed.map((raw) => toReceipt(raw)).map((r) => [r.id, r]));
  }

  async list(): Promise<Receipt[]> {
    return [...this.receipts.values()];
  }

  async getById(id: string): Promise<Receipt | null> {
    return this.receipts.get(id) ?? null;
  }

  async save(receipt: Receipt): Promise<Receipt> {
    this.receipts = new Map(this.receipts).set(receipt.id, receipt);
    return receipt;
  }
}
