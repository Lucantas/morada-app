import type { Receipt } from './receipt';

const REF_PATTERN = /^(\d{2})\/(\d{4})$/;

function recencyKey(receipt: Receipt): string {
  if (receipt.dueDate) return receipt.dueDate;
  const match = REF_PATTERN.exec(receipt.ref);
  if (match) return `${match[2]}-${match[1]}-01`;
  return '0000-00-00';
}

export function sortReceiptsByRecencyDesc(receipts: Receipt[]): Receipt[] {
  return [...receipts].sort((a, b) => {
    const keyA = recencyKey(a);
    const keyB = recencyKey(b);
    if (keyA !== keyB) return keyB.localeCompare(keyA);
    return a.id.localeCompare(b.id);
  });
}
