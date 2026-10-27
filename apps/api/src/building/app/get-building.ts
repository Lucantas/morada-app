import type { ResidentRepository } from '../../residents/domain/resident-repository';
import { buildBuildingView, type Building } from '../domain/building';
import type { BuildingRepository } from '../domain/building-repository';

export async function getBuilding(
  building: BuildingRepository,
  residents: ResidentRepository,
): Promise<Building> {
  const [apartments, occupants] = await Promise.all([building.listActive(), residents.list()]);
  return buildBuildingView(
    apartments,
    occupants.map((resident) => ({
      apartmentId: resident.apartmentId,
      residentId: resident.id,
      name: resident.name,
      status: resident.status,
    })),
  );
}
