import type { PlacedApartment } from './building';

export interface BuildingRepository {
  listActive(): Promise<PlacedApartment[]>;
  add(input: {
    label: string;
    block: string | null;
    floor: number | null;
  }): Promise<PlacedApartment>;
  rename(id: string, label: string): Promise<PlacedApartment>;
  deactivate(id: string): Promise<void>;
  hasActiveResident(id: string): Promise<boolean>;
}
