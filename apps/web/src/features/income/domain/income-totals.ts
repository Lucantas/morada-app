import type { Income } from './income';

export function incomeMonthlyTotals(incomes: Income[]): Record<string, number> {
  return incomes.reduce<Record<string, number>>((totals, income) => {
    if (!income.date) {
      return totals;
    }

    const month = income.date.slice(0, 7);
    return {
      ...totals,
      [month]: (totals[month] ?? 0) + income.valueCents,
    };
  }, {});
}
