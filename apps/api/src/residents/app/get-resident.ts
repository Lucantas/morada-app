import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import { deriveResidentStatus } from '../domain/derive-status';
import { ResidentNotFoundError } from '../domain/errors';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export async function getResident(
  repo: ResidentRepository,
  receipts: ReceiptRepository,
  id: string,
): Promise<Resident> {
  const resident = await repo.getById(id);
  if (!resident) throw new ResidentNotFoundError(id);
  const mine = await receipts.listByResident(id);
  return { ...resident, status: deriveResidentStatus(mine.some((r) => r.status === 'pendente')) };
}
