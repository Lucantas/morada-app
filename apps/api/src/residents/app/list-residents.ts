import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import { deriveResidentStatus } from '../domain/derive-status';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export async function listResidents(
  repo: ResidentRepository,
  receipts: ReceiptRepository,
): Promise<Resident[]> {
  const [residents, allReceipts] = await Promise.all([repo.list(), receipts.list()]);
  const pending = new Set(
    allReceipts.filter((r) => r.status === 'pendente' && r.residentId).map((r) => r.residentId),
  );
  return residents
    .map((r) => ({ ...r, status: deriveResidentStatus(pending.has(r.id)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
