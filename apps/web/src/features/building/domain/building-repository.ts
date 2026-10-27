import type { Building } from './building';

export type NewApartment = { label: string; block: string | null; floor: number | null };

export interface BuildingRepository {
  get(): Promise<Building>;
  addApartment(input: NewApartment): Promise<void>;
  renameApartment(id: string, label: string): Promise<void>;
  deactivateApartment(id: string): Promise<void>;
}
