import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import { deriveResidentStatus } from '../domain/derive-status';
import { ResidentNotFoundError } from '../domain/errors';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getResident(
  repo: ResidentRepository,
  receipts: ReceiptRepository,
  id: string,
): Promise<Resident> {
  const resident = await repo.getById(id);
  if (!resident) throw new ResidentNotFoundError(id);
  const mine = await receipts.listByResident(id);
  const status = deriveResidentStatus(
    mine.map((r) => ({ status: r.status, dueDate: r.dueDate })),
    today(),
  );
  return { ...resident, status };
}
