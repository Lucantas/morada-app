import type { Resident } from './resident';

export function filterResidents(residents: Resident[], query: string): Resident[] {
  const q = query.trim().toLowerCase();
  if (!q) return residents;
  return residents.filter(
    (r) => r.name.toLowerCase().includes(q) || r.apt.toLowerCase().includes(q),
  );
}
