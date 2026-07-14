// ISO calendar date (YYYY-MM-DD) -> Brazilian display (DD/MM/YYYY).
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
