import type { Category } from '@/features/categories/domain/category';

import { categoryDrafts, openingBalanceFor, planGround, type GroundInput } from './ground';

const TODAY = '2026-10-27';
const CURRENT = ['Água', 'Energia', 'Serviços', 'Manutenção'];

function input(overrides: Partial<GroundInput> = {}): GroundInput {
  return { categories: CURRENT, spend: { kind: 'none' }, cashCents: null, ...overrides };
}

describe('planGround', () => {
  test('per-category spend becomes paid accounts', () => {
    const plan = planGround(
      input({
        spend: {
          kind: 'byCategory',
          items: [
            { category: 'Água', cents: 34800 },
            { category: 'Energia', cents: 0 },
          ],
        },
      }),
      CURRENT,
      TODAY,
    );

    expect(plan.accounts).toEqual([
      { slot: 'Água', description: 'Água de outubro', category: 'Água', valueCents: 34800 },
    ]);
  });

  test('total spend goes to Serviços', () => {
    const plan = planGround(input({ spend: { kind: 'total', cents: 348000 } }), CURRENT, TODAY);

    expect(plan.accounts).toEqual([
      { slot: 'total', description: 'Gastos de outubro', category: 'Serviços', valueCents: 348000 },
    ]);
  });

  test('total spend goes to the first category without Serviços', () => {
    const plan = planGround(
      input({ categories: ['Energia', 'Água'], spend: { kind: 'total', cents: 1000 } }),
      CURRENT,
      TODAY,
    );

    expect(plan.accounts).toEqual([
      { slot: 'total', description: 'Gastos de outubro', category: 'Energia', valueCents: 1000 },
    ]);
  });

  test('a zero total creates no account', () => {
    const plan = planGround(input({ spend: { kind: 'total', cents: 0 } }), CURRENT, TODAY);

    expect(plan.accounts).toEqual([]);
  });

  test('opening balance adds today’s spend back', () => {
    const plan = planGround(
      input({ spend: { kind: 'total', cents: 348_000 }, cashCents: 1_230_000 }),
      CURRENT,
      TODAY,
    );

    expect(plan.openingBalance).toEqual({ valueCents: 1_578_000, date: TODAY });
  });

  test('an empty cash still opens the balance', () => {
    const plan = planGround(input({ cashCents: 0 }), CURRENT, TODAY);

    expect(plan.openingBalance).toEqual({ valueCents: 0, date: TODAY });
  });

  test('skipped cash means no opening balance', () => {
    const plan = planGround(
      input({ spend: { kind: 'total', cents: 348_000 }, cashCents: null }),
      CURRENT,
      TODAY,
    );

    expect(plan.openingBalance).toBeNull();
  });

  test('unchanged categories are not saved', () => {
    expect(planGround(input(), CURRENT, TODAY).categories).toBeNull();
  });

  test('changed categories are saved', () => {
    const next = ['Água', 'Limpeza'];

    expect(planGround(input({ categories: next }), CURRENT, TODAY).categories).toEqual(next);
  });
});

describe('openingBalanceFor', () => {
  test('adds the month spend to the cash', () => {
    expect(openingBalanceFor(1_230_000, 348_000)).toBe(1_578_000);
  });
});

describe('categoryDrafts', () => {
  test('keeps ids and keywords of existing categories and adds new ones', () => {
    const existing: Category[] = [
      { id: 'c-1', name: 'Água', keywords: 'cedae', position: 0 },
      { id: 'c-2', name: 'Energia', keywords: '', position: 1 },
    ];

    expect(categoryDrafts(['Água', 'Limpeza'], existing)).toEqual([
      { id: 'c-1', name: 'Água', keywords: 'cedae' },
      { name: 'Limpeza', keywords: '' },
    ]);
  });
});
