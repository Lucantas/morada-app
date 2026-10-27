import { saveAccount } from '@/features/accounts/domain/save-account';
import type { AccountRepository } from '@/features/accounts/domain/account-repository';
import type { Category } from '@/features/categories/domain/category';
import type { CategoryRepository } from '@/features/categories/domain/category-repository';
import type { SettingsRepository } from '@/features/settings/domain/settings-repository';

import { categoryDrafts, TOTAL_SLOT, type GroundPlan } from './ground';
import type { OnboardingRepository } from './onboarding-repository';

export type OpenCondoDeps = {
  categories: Pick<CategoryRepository, 'save'>;
  accounts: Pick<AccountRepository, 'save'>;
  settings: SettingsRepository;
  onboarding: OnboardingRepository;
};

export type OpenCondoContext = OpenCondoDeps & {
  existingCategories: readonly Category[];
  today: string;
  condoId: string;
};

const MAX_ACCOUNT_ID = 64;

function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function onboardingAccountId(condoId: string, slot: string): string {
  const suffix = slot === TOTAL_SLOT ? TOTAL_SLOT : `c${shortHash(slot)}`;
  const readable = `onb-${condoId}-${suffix}`;
  return readable.length <= MAX_ACCOUNT_ID ? readable : `onb-${shortHash(condoId)}-${suffix}`;
}

type Step = { key: string; run: () => Promise<unknown> };

function planSteps(plan: GroundPlan, context: OpenCondoContext): Step[] {
  const { categories, openingBalance } = plan;
  const categoryStep: Step[] =
    categories === null
      ? []
      : [
          {
            key: 'categories',
            run: () =>
              context.categories.save(categoryDrafts(categories, context.existingCategories)),
          },
        ];
  const accountSteps: Step[] = plan.accounts.map(({ slot, ...account }) => ({
    key: `account:${account.description}`,
    run: () =>
      saveAccount(context.accounts, {
        ...account,
        id: onboardingAccountId(context.condoId, slot),
        status: 'pago',
        date: context.today,
      }),
  }));
  const settingsStep: Step[] =
    openingBalance === null
      ? []
      : [
          {
            key: 'settings',
            run: async () => {
              const current = await context.settings.get();
              return context.settings.save({
                monthlyFeeCents: current.monthlyFeeCents,
                dueDay: current.dueDay,
                openingBalance,
              });
            },
          },
        ];
  const completeStep: Step = { key: 'complete', run: () => context.onboarding.complete() };
  return [...categoryStep, ...accountSteps, ...settingsStep, completeStep];
}

export async function openCondo(
  plan: GroundPlan,
  context: OpenCondoContext,
  onStepDone: (step: string) => void,
): Promise<void> {
  for (const step of planSteps(plan, context)) {
    await step.run();
    onStepDone(step.key);
  }
}
