import type { ResidentStatus } from './resident';

// Payment status is derived from receipts, not stored: a resident with any
// pending receipt is `pendente`, otherwise `em_dia`. (`atrasado` needs due-date
// data receipts do not carry yet, so it is never produced here.)
export function deriveResidentStatus(hasPendingReceipt: boolean): ResidentStatus {
  return hasPendingReceipt ? 'pendente' : 'em_dia';
}
