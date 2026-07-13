import type { Receipt } from './receipt';

export interface ReceiptRepository {
  list(): Receipt[];
  listByResident(residentId: string): Receipt[];
  listByApartment(apartmentId: string): Receipt[];
  getById(id: string): Receipt | null;
  save(receipt: Receipt): Receipt;
}
