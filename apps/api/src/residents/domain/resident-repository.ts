import type { Resident } from './resident';

export interface ResidentRepository {
  list(): Resident[];
  getById(id: string): Resident | null;
  save(resident: Resident): Resident;
}
