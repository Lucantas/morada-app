import type { Resident, ResidentStatus } from './resident';

export interface ResidentRepository {
  list(): Promise<Resident[]>;
  getById(id: string): Promise<Resident | null>;
  getCurrent(subject: string): Promise<Resident | null>;
  /** An apartment's occupant history (admin): current resident + everyone who moved out. */
  listByApartment(apartmentId: string): Promise<Resident[]>;
  save(resident: Resident): Promise<Resident>;
  /** Mark a resident as moved out, freeing their apartment. */
  deactivate(id: string): Promise<void>;
  /** Admin-only: override a resident's payment status, or clear it (null → derived). */
  setStatusOverride(id: string, status: ResidentStatus | null): Promise<void>;
}
