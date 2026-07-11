import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { toResident } from './resident-row';

export class InMemoryResidentRepository implements ResidentRepository {
  private residents: Map<string, Resident>;

  constructor(seed: readonly unknown[] = []) {
    this.residents = new Map(seed.map((raw) => toResident(raw)).map((r) => [r.id, r]));
  }

  async list(): Promise<Resident[]> {
    return [...this.residents.values()];
  }

  async getById(id: string): Promise<Resident | null> {
    return this.residents.get(id) ?? null;
  }

  async save(resident: Resident): Promise<Resident> {
    this.residents = new Map(this.residents).set(resident.id, resident);
    return resident;
  }
}
