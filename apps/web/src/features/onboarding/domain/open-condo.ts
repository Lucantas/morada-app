import { saveAccount } from '@/features/accounts/domain/save-account';
import type { AccountRepository } from '@/features/accounts/domain/account-repository';
import type { Category } from '@/features/categories/domain/category';
import type { CategoryRepository } from '@/features/categories/domain/category-repository';
import type { SettingsRepository } from '@/features/settings/domain/settings-repository';

import { categoryDrafts, type GroundPlan } from './ground';
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
};

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
  const accountSteps: Step[] = plan.accounts.map((account) => ({
    key: `account:${account.description}`,
    run: () => saveAccount(context.accounts, { ...account, status: 'pago', date: context.today }),
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
  done: readonly string[],
  markDone: (step: string) => void,
): Promise<void> {
  const pending = planSteps(plan, context).filter((step) => !done.includes(step.key));
  for (const step of pending) {
    await step.run();
    markDone(step.key);
  }
}
