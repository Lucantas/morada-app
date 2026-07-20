import type { Income } from './income';

export function sortIncomesByDateDesc(incomes: Income[]): Income[] {
  return [...incomes].sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? 1 : -1;
    }
    return a.id.localeCompare(b.id);
  });
}
