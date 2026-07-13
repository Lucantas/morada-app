import type { Resident } from './resident';

export interface ResidentRepository {
  /** Active occupants (one per apartment), each joined with their apartment. */
  list(): Promise<Resident[]>;
  /** Any resident (active or moved out) with their apartment. */
  getById(id: string): Promise<Resident | null>;
  /** Every resident who has occupied an apartment — the apartment's history. */
  listByApartment(apartmentId: string): Promise<Resident[]>;
  /** The apartment a resident occupies (for scoping receipts). */
  apartmentOf(residentId: string): Promise<{ apartmentId: string; apt: string } | null>;
  /** Create (find-or-create the apartment + active occupancy) or update a resident. */
  save(input: {
    id: string;
    name: string;
    apt: string;
    phone: string;
    email: string;
    status: Resident['status'];
  }): Promise<Resident>;
  /** Mark a resident as moved out, freeing their apartment for the next occupant. */
  deactivate(id: string): Promise<void>;
}
