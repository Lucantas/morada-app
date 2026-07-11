export function parseReaisToCents(input: string): number {
  const normalized = input.replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}
