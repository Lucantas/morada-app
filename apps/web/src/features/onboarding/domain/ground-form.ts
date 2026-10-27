import type { GroundInput } from './ground';

export type SpendMode = 'byCategory' | 'total' | 'later';
export type CashMode = 'value' | 'empty' | 'later';

export type GroundForm = {
  options: readonly string[];
  selected: readonly string[];
  spendMode: SpendMode;
  perCategory: Readonly<Record<string, number>>;
  totalCents: number;
  cashMode: CashMode;
  cashCents: number;
};

const MAX_CATEGORY_NAME = 60;

export function initialGroundForm(names: readonly string[]): GroundForm {
  return {
    options: [...names],
    selected: [...names],
    spendMode: 'byCategory',
    perCategory: {},
    totalCents: 0,
    cashMode: 'value',
    cashCents: 0,
  };
}

export function selectedCategories(form: GroundForm): string[] {
  return form.options.filter((name) => form.selected.includes(name));
}

export function toggleCategory(form: GroundForm, name: string): GroundForm {
  const selected = form.selected.includes(name)
    ? form.selected.filter((item) => item !== name)
    : [...form.selected, name];
  return { ...form, selected };
}

export function setCategorySpend(form: GroundForm, name: string, cents: number): GroundForm {
  return { ...form, perCategory: { ...form.perCategory, [name]: cents } };
}

export function addCategory(
  form: GroundForm,
  raw: string,
): { form: GroundForm } | { error: string } {
  const name = raw.trim();
  if (name === '') return { error: 'Informe o nome da conta.' };
  if (name.length > MAX_CATEGORY_NAME) return { error: 'Use até 60 caracteres.' };
  const taken = form.options.some((option) => option.toLowerCase() === name.toLowerCase());
  if (taken) return { error: 'Essa conta já está na lista.' };
  return {
    form: { ...form, options: [...form.options, name], selected: [...form.selected, name] },
  };
}

function cashFrom(form: GroundForm): number | null {
  if (form.cashMode === 'empty') return 0;
  if (form.cashMode === 'later') return null;
  return form.cashCents > 0 ? form.cashCents : null;
}

function spendFrom(form: GroundForm, categories: string[]): GroundInput['spend'] {
  if (form.spendMode === 'later') return { kind: 'none' };
  if (form.spendMode === 'total') return { kind: 'total', cents: form.totalCents };
  const items = categories.map((category) => ({
    category,
    cents: form.perCategory[category] ?? 0,
  }));
  return { kind: 'byCategory', items: items.some((item) => item.cents > 0) ? items : [] };
}

export function groundInputFromForm(form: GroundForm): GroundInput {
  const categories = selectedCategories(form);
  return { categories, spend: spendFrom(form, categories), cashCents: cashFrom(form) };
}
