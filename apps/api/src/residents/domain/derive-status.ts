import type { ResidentStatus } from './resident';

type PendingReceipt = { status: string; dueDate: string | null };

// Payment status is derived from a resident's receipts, not stored:
// - no pending receipt            -> em_dia
// - a pending receipt past its due -> atrasado
// - otherwise (pending, not due)   -> pendente
// Dates are ISO (YYYY-MM-DD), so lexical comparison is chronological.
export function deriveResidentStatus(receipts: PendingReceipt[], today: string): ResidentStatus {
  const pending = receipts.filter((r) => r.status === 'pendente');
  if (pending.length === 0) return 'em_dia';
  if (pending.some((r) => r.dueDate !== null && r.dueDate < today)) return 'atrasado';
  return 'pendente';
}
