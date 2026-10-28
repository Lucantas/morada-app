import type { Category } from '@/features/categories/domain/category';

import type { GroundPlan } from './ground';
import { onboardingAccountId, openCondo, type OpenCondoDeps } from './open-condo';

const TODAY = '2026-10-27';
const CONDO_ID = 'condo-1';
const EXISTING: Category[] = [{ id: 'c-1', name: 'Água', keywords: 'cedae', position: 0 }];

const FULL_PLAN: GroundPlan = {
  categories: ['Água', 'Limpeza'],
  accounts: [{ slot: 'Água', description: 'Água de outubro', category: 'Água', valueCents: 34800 }],
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

    await openCondo(
      FULL_PLAN,
      { ...d, existingCategories: EXISTING, today: TODAY, condoId: CONDO_ID },
      (step) => done.push(step),
    );

    expect(calls).toEqual(['categories', 'account', 'settings', 'complete']);
    expect(d.categories.save).toHaveBeenCalledWith([
      { id: 'c-1', name: 'Água', keywords: 'cedae' },
      { name: 'Limpeza', keywords: '' },
    ]);
    expect(d.accounts.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: onboardingAccountId(CONDO_ID, 'Água'),
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
      { ...d, existingCategories: EXISTING, today: TODAY, condoId: CONDO_ID },
      jest.fn(),
    );

    expect(d.categories.save).not.toHaveBeenCalled();
    expect(d.accounts.save).not.toHaveBeenCalled();
    expect(d.settings.get).not.toHaveBeenCalled();
    expect(d.settings.save).not.toHaveBeenCalled();
    expect(d.onboarding.complete).toHaveBeenCalledTimes(1);
  });

  test('a retry re-runs every step with the same account ids', async () => {
    const d = deps();

    await openCondo(
      FULL_PLAN,
      { ...d, existingCategories: EXISTING, today: TODAY, condoId: CONDO_ID },
      jest.fn(),
    );
    await openCondo(
      FULL_PLAN,
      { ...d, existingCategories: EXISTING, today: TODAY, condoId: CONDO_ID },
      jest.fn(),
    );

    expect(d.categories.save).toHaveBeenCalledTimes(2);
    expect(d.accounts.save).toHaveBeenCalledTimes(2);
    expect(jest.mocked(d.accounts.save).mock.calls.map(([account]) => account.id)).toEqual([
      onboardingAccountId(CONDO_ID, 'Água'),
      onboardingAccountId(CONDO_ID, 'Água'),
    ]);
    expect(d.settings.save).toHaveBeenCalledTimes(2);
    expect(d.onboarding.complete).toHaveBeenCalledTimes(2);
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
      openCondo(
        FULL_PLAN,
        { ...d, existingCategories: EXISTING, today: TODAY, condoId: CONDO_ID },
        (step) => done.push(step),
      ),
    ).rejects.toThrow('falhou');

    expect(done).toEqual(['categories', 'account:Água de outubro']);
    expect(d.onboarding.complete).not.toHaveBeenCalled();
  });
});

describe('onboardingAccountId', () => {
  const UUID = '0b9d3c1e-5f4a-4c7e-9a2b-8d6f1e3c5a7b';

  test('names the total after the condo', () => {
    expect(onboardingAccountId(UUID, 'total')).toBe(`onb-${UUID}-total`);
  });

  test('is stable and distinct per category, and fits the account id limit', () => {
    const long = 'Manutenção preventiva dos elevadores e do portão da garagem';

    expect(onboardingAccountId(UUID, 'Água')).toBe(onboardingAccountId(UUID, 'Água'));
    expect(onboardingAccountId(UUID, 'Água')).not.toBe(onboardingAccountId(UUID, 'Energia'));
    expect(onboardingAccountId(UUID, 'total')).not.toBe(onboardingAccountId('other', 'total'));
    expect(onboardingAccountId(UUID, long).length).toBeLessThanOrEqual(64);
  });

  test('a condo id too long to fit is hashed', () => {
    const id = onboardingAccountId('x'.repeat(70), 'total');

    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).toMatch(/^onb-[0-9a-f]{8}-total$/);
  });
});
