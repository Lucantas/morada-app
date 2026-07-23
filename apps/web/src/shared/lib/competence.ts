export function maskCompetence(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
