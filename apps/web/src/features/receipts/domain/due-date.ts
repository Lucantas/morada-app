export function dueDateFromRef(ref: string, dueDay: number): string | null {
  const match = /^\s*(\d{1,2})\/(\d{4})\s*$/.exec(ref);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(dueDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
