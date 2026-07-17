import type { Receipt, ReceiptMethod } from '../domain/receipt';
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

  async listByApartment(apartmentId: string): Promise<Receipt[]> {
    return [...this.receipts.values()].filter((r) => r.apartmentId === apartmentId);
  }

  async getById(id: string): Promise<Receipt | null> {
    return this.receipts.get(id) ?? null;
  }

  async save(receipt: Receipt): Promise<Receipt> {
    this.receipts = new Map(this.receipts).set(receipt.id, receipt);
    return receipt;
  }

  async submitPayment(
    id: string,
    input: { method: ReceiptMethod; proofDataUrl: string },
  ): Promise<Receipt> {
    const current = this.receipts.get(id);
    if (!current) throw new Error(`Receipt ${id} not found`);
    const updated: Receipt = {
      ...current,
      status: 'em_analise',
      method: input.method,
      proofDataUrl: input.proofDataUrl,
      submittedAt: new Date().toISOString().slice(0, 10),
    };
    this.receipts = new Map(this.receipts).set(id, updated);
    return updated;
  }

  async archive(id: string): Promise<void> {
    const next = new Map(this.receipts);
    next.delete(id);
    this.receipts = next;
  }
}
