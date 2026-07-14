import type { Receipt } from './receipt';

export interface ReceiptRepository {
  list(): Promise<Receipt[]>;
  /** An apartment's full receipt ledger (admin), across every occupant. */
  listByApartment(apartmentId: string): Promise<Receipt[]>;
  getById(id: string): Promise<Receipt | null>;
  save(receipt: Receipt): Promise<Receipt>;
}
