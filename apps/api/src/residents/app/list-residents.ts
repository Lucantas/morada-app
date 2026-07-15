import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import { deriveResidentStatus } from '../domain/derive-status';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listResidents(
  repo: ResidentRepository,
  receipts: ReceiptRepository,
): Promise<Resident[]> {
  const [residents, allReceipts] = await Promise.all([repo.list(), receipts.list()]);
  const now = today();
  const byResident = new Map<string, { status: string; dueDate: string | null }[]>();
  for (const r of allReceipts) {
    if (!r.residentId) continue;
    const list = byResident.get(r.residentId) ?? [];
    list.push({ status: r.status, dueDate: r.dueDate });
    byResident.set(r.residentId, list);
  }
  return residents
    .map((r) => ({
      ...r,
      status: r.statusOverride ?? deriveResidentStatus(byResident.get(r.id) ?? [], now),
    }))
    .sort((a, b) => a.apt.localeCompare(b.apt, 'pt-BR', { numeric: true }));
}
