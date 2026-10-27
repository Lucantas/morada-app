import { z } from 'zod';

import type { ResidentStatus } from '../../residents/domain/resident';

export const apartmentStateSchema = z.enum(['vazio', 'ocupado', 'pendente', 'atrasado']);
export type ApartmentState = z.infer<typeof apartmentStateSchema>;

export const buildingApartmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  state: apartmentStateSchema,
  residentId: z.string().nullable(),
  residentName: z.string().nullable(),
});
export type BuildingApartment = z.infer<typeof buildingApartmentSchema>;

export const buildingSchema = z.object({
  blocks: z.array(
    z.object({
      name: z.string().nullable(),
      floors: z.array(
        z.object({ floor: z.number().int(), apartments: z.array(buildingApartmentSchema) }),
      ),
    }),
  ),
  unplaced: z.array(buildingApartmentSchema),
});
export type Building = z.infer<typeof buildingSchema>;

export interface PlacedApartment {
  id: string;
  label: string;
  block: string | null;
  floor: number | null;
  position: number | null;
}

export interface BuildingOccupant {
  apartmentId: string;
  residentId: string;
  name: string;
  status: ResidentStatus;
}

const STATE_BY_STATUS: Record<ResidentStatus, ApartmentState> = {
  em_dia: 'ocupado',
  pendente: 'pendente',
  atrasado: 'atrasado',
};

const byLabel = (a: PlacedApartment, b: PlacedApartment) => a.label.localeCompare(b.label, 'pt');

const byPositionThenLabel = (a: PlacedApartment, b: PlacedApartment) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
  byLabel(a, b);

const byBlockName = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b, 'pt');
};

export function buildBuildingView(
  apartments: PlacedApartment[],
  occupants: BuildingOccupant[],
): Building {
  const occupantByApartment = new Map(occupants.map((o) => [o.apartmentId, o]));
  const toView = (apartment: PlacedApartment): BuildingApartment => {
    const occupant = occupantByApartment.get(apartment.id);
    return {
      id: apartment.id,
      label: apartment.label,
      state: occupant ? STATE_BY_STATUS[occupant.status] : 'vazio',
      residentId: occupant?.residentId ?? null,
      residentName: occupant?.name ?? null,
    };
  };

  const placed = apartments.filter((a) => a.floor !== null);
  const blockNames = [...new Set(placed.map((a) => a.block))].sort(byBlockName);

  const blocks = blockNames.map((name) => {
    const inBlock = placed.filter((a) => a.block === name);
    const floorNumbers = [...new Set(inBlock.map((a) => a.floor ?? 0))].sort((a, b) => b - a);
    return {
      name,
      floors: floorNumbers.map((floor) => ({
        floor,
        apartments: inBlock
          .filter((a) => a.floor === floor)
          .sort(byPositionThenLabel)
          .map(toView),
      })),
    };
  });

  const unplaced = apartments
    .filter((a) => a.floor === null)
    .sort(byLabel)
    .map(toView);

  return { blocks, unplaced };
}
