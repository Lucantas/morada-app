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

export type GroundAccount = {
  slot: string;
  description: string;
  category: string;
  valueCents: number;
};

export const TOTAL_SLOT = 'total';

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

function savedCategories(selected: readonly string[], accounts: GroundAccount[]): string[] {
  const missing = accounts
    .map((account) => account.category)
    .filter(
      (category, index, all) => !selected.includes(category) && all.indexOf(category) === index,
    );
  return [...selected, ...missing];
}

function spendAccounts(input: GroundInput, month: string): GroundAccount[] {
  const { spend } = input;
  if (spend.kind === 'none') return [];
  if (spend.kind === 'total') {
    return spend.cents > 0
      ? [
          {
            slot: TOTAL_SLOT,
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
      slot: item.category,
      description: `${item.category} de ${month}`,
      category: item.category,
      valueCents: item.cents,
    }));
}

function openingBalanceOf(
  cashCents: number | null,
  spendTotal: number,
  today: string,
): GroundPlan['openingBalance'] {
  if (cashCents === null && spendTotal === 0) return null;
  return { valueCents: openingBalanceFor(cashCents ?? 0, spendTotal), date: today };
}

export function planGround(input: GroundInput, current: string[], today: string): GroundPlan {
  const accounts = spendAccounts(input, formatMonthName(today));
  const spendTotal = accounts.reduce((sum, account) => sum + account.valueCents, 0);
  const names = savedCategories(input.categories, accounts);
  return {
    categories: sameNames(names, current) ? null : names,
    accounts,
    openingBalance: openingBalanceOf(input.cashCents, spendTotal, today),
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
