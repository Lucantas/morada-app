import { z } from 'zod';

export const apartmentStateSchema = z.enum(['vazio', 'ocupado', 'pendente', 'atrasado']);
export type ApartmentState = z.infer<typeof apartmentStateSchema>;

export const buildingApartmentSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  state: apartmentStateSchema,
  residentId: z.string().nullable(),
  residentName: z.string().nullable(),
});
export type BuildingApartment = z.infer<typeof buildingApartmentSchema>;

export const buildingFloorSchema = z.object({
  floor: z.number().int(),
  apartments: z.array(buildingApartmentSchema),
});
export type BuildingFloor = z.infer<typeof buildingFloorSchema>;

export const buildingBlockSchema = z.object({
  name: z.string().nullable(),
  floors: z.array(buildingFloorSchema),
});
export type BuildingBlock = z.infer<typeof buildingBlockSchema>;

export const buildingSchema = z.object({
  blocks: z.array(buildingBlockSchema),
  unplaced: z.array(buildingApartmentSchema),
});
export type Building = z.infer<typeof buildingSchema>;

export function countApartments(building: Building): number {
  const placed = building.blocks.reduce(
    (total, block) => total + block.floors.reduce((sum, floor) => sum + floor.apartments.length, 0),
    0,
  );
  return placed + building.unplaced.length;
}
