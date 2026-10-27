import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import { listResidents } from '../../residents/app/list-residents';
import type { ResidentRepository } from '../../residents/domain/resident-repository';
import { buildBuildingView, type Building } from '../domain/building';
import type { BuildingRepository } from '../domain/building-repository';

export async function getBuilding(
  building: BuildingRepository,
  residents: ResidentRepository,
  receipts: ReceiptRepository,
): Promise<Building> {
  const [apartments, occupants] = await Promise.all([
    building.listActive(),
    listResidents(residents, receipts),
  ]);
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
