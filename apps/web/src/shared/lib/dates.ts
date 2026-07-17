// ISO calendar date (YYYY-MM-DD) -> Brazilian display (DD/MM/YYYY).
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

// Month key or ISO date (YYYY-MM or YYYY-MM-DD) -> pt-BR month name (lowercase).
export function formatMonthName(monthOrIso: string): string {
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ] as const;

  const isoPrefix = monthOrIso.slice(0, 7);
  const parts = isoPrefix.split('-');
  const monthStr = parts[1];

  if (!monthStr) return '';

  const monthNum = parseInt(monthStr, 10);
  if (monthNum < 1 || monthNum > 12) return '';

  const month = months[monthNum - 1];
  return month ?? '';
}
