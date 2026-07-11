import type { Resident } from './resident';

export type ResidentStats = { total: number; emDia: number; pendencias: number };

export function residentStats(residents: Resident[]): ResidentStats {
  const emDia = residents.filter((r) => r.status === 'em_dia').length;
  return {
    total: residents.length,
    emDia,
    pendencias: residents.length - emDia,
  };
}
