import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';

import { receiptSchema, type Receipt, type ReceiptMethod } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

const receiptListSchema = z.array(receiptSchema);

export class HttpReceiptRepository implements ReceiptRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Receipt[]> {
    return receiptListSchema.parse(await this.api.get('/api/receipts'));
  }

  async listByApartment(apartmentId: string): Promise<Receipt[]> {
    return receiptListSchema.parse(await this.api.get(`/api/apartments/${apartmentId}/receipts`));
  }

  async getById(id: string): Promise<Receipt | null> {
    try {
      return receiptSchema.parse(await this.api.get(`/api/receipts/${id}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async save(receipt: Receipt): Promise<Receipt> {
    // save maps to the admin pay endpoint; the server derives the paid
    // status and returns the updated receipt.
    const response = await this.api.post(`/api/receipts/${receipt.id}/pay`, {
      method: receipt.method,
    });
    return receiptSchema.parse(response);
  }

  async submitPayment(
    id: string,
    input: { method: ReceiptMethod; proofDataUrl: string },
  ): Promise<Receipt> {
    const response = await this.api.post(`/api/receipts/${id}/submit-payment`, {
      method: input.method,
      proofDataUrl: input.proofDataUrl,
    });
    return receiptSchema.parse(response);
  }

  async archive(id: string): Promise<void> {
    await this.api.del(`/api/receipts/${id}`);
  }
}
