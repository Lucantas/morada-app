import type { Category, CategoryDraft } from '@/features/categories/domain/category';
import { formatMonthName } from '@/shared/lib/dates';

export type GroundSpend =
  | { kind: 'none' }
  | { kind: 'total'; cents: number }
  | { kind: 'byCategory'; items: { category: string; cents: number }[] };

export type GroundInput = {
  categories: string[];
  spend: GroundSpend;
  cashCents: number | null;
};

export type GroundAccount = { description: string; category: string; valueCents: number };

export type GroundPlan = {
  categories: string[] | null;
  accounts: GroundAccount[];
  openingBalance: { valueCents: number; date: string } | null;
};

const TOTAL_CATEGORY = 'Serviços';

export function openingBalanceFor(cashCents: number, spendTotal: number): number {
  return cashCents + spendTotal;
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

function totalCategory(categories: readonly string[]): string {
  return categories.includes(TOTAL_CATEGORY) ? TOTAL_CATEGORY : (categories[0] ?? TOTAL_CATEGORY);
}

function spendAccounts(input: GroundInput, month: string): GroundAccount[] {
  const { spend } = input;
  if (spend.kind === 'none') return [];
  if (spend.kind === 'total') {
    return spend.cents > 0
      ? [
          {
            description: `Gastos de ${month}`,
            category: totalCategory(input.categories),
            valueCents: spend.cents,
          },
        ]
      : [];
  }
  return spend.items
    .filter((item) => item.cents > 0)
    .map((item) => ({
      description: `${item.category} de ${month}`,
      category: item.category,
      valueCents: item.cents,
    }));
}

export function planGround(input: GroundInput, current: string[], today: string): GroundPlan {
  const accounts = spendAccounts(input, formatMonthName(today));
  const spendTotal = accounts.reduce((sum, account) => sum + account.valueCents, 0);
  return {
    categories: sameNames(input.categories, current) ? null : [...input.categories],
    accounts,
    openingBalance:
      input.cashCents === null
        ? null
        : { valueCents: openingBalanceFor(input.cashCents, spendTotal), date: today },
  };
}

export function categoryDrafts(
  names: readonly string[],
  existing: readonly Category[],
): CategoryDraft[] {
  return names.map((name) => {
    const found = existing.find((category) => category.name === name);
    return found
      ? { id: found.id, name: found.name, keywords: found.keywords }
      : { name, keywords: '' };
  });
}
