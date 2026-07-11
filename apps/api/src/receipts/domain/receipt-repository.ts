import type { Receipt } from './receipt';

export interface ReceiptRepository {
  list(): Receipt[];
  getById(id: string): Receipt | null;
  save(receipt: Receipt): Receipt;
}
