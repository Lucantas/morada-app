import type { Receipt } from './receipt';

export function sortByDueDateDesc(receipts: Receipt[]): Receipt[] {
  return [...receipts].sort((a, b) => {
    if (a.dueDate === b.dueDate) return a.id.localeCompare(b.id);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate > b.dueDate ? -1 : 1;
  });
}
