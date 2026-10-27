import type { Category } from '@/features/categories/domain/category';

import type { GroundPlan } from './ground';
import { openCondo, type OpenCondoDeps } from './open-condo';

const TODAY = '2026-10-27';
const EXISTING: Category[] = [{ id: 'c-1', name: 'Água', keywords: 'cedae', position: 0 }];

const FULL_PLAN: GroundPlan = {
  categories: ['Água', 'Limpeza'],
  accounts: [{ description: 'Água de outubro', category: 'Água', valueCents: 34800 }],
  openingBalance: { valueCents: 1_264_800, date: TODAY },
};

function deps(overrides: Partial<OpenCondoDeps> = {}): OpenCondoDeps {
  return {
    categories: { save: jest.fn().mockResolvedValue({ categories: [], reclassified: 0 }) },
    accounts: { save: jest.fn().mockImplementation(async (account) => account) },
    settings: {
      get: jest.fn().mockResolvedValue({
        monthlyFeeCents: 35000,
        dueDay: 10,
        pix: null,
        openingBalance: null,
      }),
      save: jest.fn().mockResolvedValue({}),
    },
    onboarding: { complete: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

describe('openCondo', () => {
  test('saves categories, accounts, the opening balance and completes, in order', async () => {
    const calls: string[] = [];
    const d = deps();
    jest.mocked(d.categories.save).mockImplementation(async () => {
      calls.push('categories');
      return { categories: [], reclassified: 0 };
    });
    jest.mocked(d.accounts.save).mockImplementation(async (account) => {
      calls.push('account');
      return account;
    });
    jest.mocked(d.settings.save).mockImplementation(async () => {
      calls.push('settings');
      return { monthlyFeeCents: 35000, dueDay: 10, pix: null, openingBalance: null };
    });
    jest.mocked(d.onboarding.complete).mockImplementation(async () => {
      calls.push('complete');
    });
    const done: string[] = [];

    await openCondo(FULL_PLAN, { ...d, existingCategories: EXISTING, today: TODAY }, [], (step) =>
      done.push(step),
    );

    expect(calls).toEqual(['categories', 'account', 'settings', 'complete']);
    expect(d.categories.save).toHaveBeenCalledWith([
      { id: 'c-1', name: 'Água', keywords: 'cedae' },
      { name: 'Limpeza', keywords: '' },
    ]);
    expect(d.accounts.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Água de outubro',
        category: 'Água',
        valueCents: 34800,
        status: 'pago',
        date: TODAY,
      }),
    );
    expect(d.settings.save).toHaveBeenCalledWith({
      monthlyFeeCents: 35000,
      dueDay: 10,
      openingBalance: { valueCents: 1_264_800, date: TODAY },
    });
    expect(done).toEqual(['categories', 'account:Água de outubro', 'settings', 'complete']);
  });

  test('an empty plan only completes', async () => {
    const d = deps();

    await openCondo(
      { categories: null, accounts: [], openingBalance: null },
      { ...d, existingCategories: EXISTING, today: TODAY },
      [],
      jest.fn(),
    );

    expect(d.categories.save).not.toHaveBeenCalled();
    expect(d.accounts.save).not.toHaveBeenCalled();
    expect(d.settings.get).not.toHaveBeenCalled();
    expect(d.settings.save).not.toHaveBeenCalled();
    expect(d.onboarding.complete).toHaveBeenCalledTimes(1);
  });

  test('skips the steps already done', async () => {
    const d = deps();

    await openCondo(
      FULL_PLAN,
      { ...d, existingCategories: EXISTING, today: TODAY },
      ['categories', 'account:Água de outubro'],
      jest.fn(),
    );

    expect(d.categories.save).not.toHaveBeenCalled();
    expect(d.accounts.save).not.toHaveBeenCalled();
    expect(d.settings.save).toHaveBeenCalledTimes(1);
    expect(d.onboarding.complete).toHaveBeenCalledTimes(1);
  });

  test('stops at the first failure without marking it done', async () => {
    const d = deps({
      settings: {
        get: jest.fn().mockResolvedValue({ monthlyFeeCents: 1, dueDay: 2, pix: null }),
        save: jest.fn().mockRejectedValue(new Error('falhou')),
      },
    });
    const done: string[] = [];

    await expect(
      openCondo(FULL_PLAN, { ...d, existingCategories: EXISTING, today: TODAY }, [], (step) =>
        done.push(step),
      ),
    ).rejects.toThrow('falhou');

    expect(done).toEqual(['categories', 'account:Água de outubro']);
    expect(d.onboarding.complete).not.toHaveBeenCalled();
  });
});
