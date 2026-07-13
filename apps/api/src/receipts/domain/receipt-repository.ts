import type { Receipt } from './receipt';

export interface ReceiptRepository {
  list(): Promise<Receipt[]>;
  listByResident(residentId: string): Promise<Receipt[]>;
  listByApartment(apartmentId: string): Promise<Receipt[]>;
  getById(id: string): Promise<Receipt | null>;
  save(receipt: Receipt): Promise<Receipt>;
}
