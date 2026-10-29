import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { AccountRepository } from '@/features/accounts/domain/account-repository';
import { buildingQueryKey, type BuildingApartment } from '@/features/building/domain/building';
import type { BuildingRepository } from '@/features/building/domain/building-repository';
import type { Category } from '@/features/categories/domain/category';
import type { CategoryRepository } from '@/features/categories/domain/category-repository';
import type { ResidentRepository } from '@/features/residents/domain/resident-repository';
import type { SettingsRepository } from '@/features/settings/domain/settings-repository';
import { useCondoScope } from '@/shared/lib/condo-scope';
import { todayIso } from '@/shared/lib/dates';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { FormError } from '@/shared/ui/entry-layout';
import { PrimaryButton } from '@/shared/ui/primitives';
import { StatusView } from '@/shared/ui/status-view';

import { planGround, type GroundPlan } from '../domain/ground';
import { groundInputFromForm, initialGroundForm, type GroundForm } from '../domain/ground-form';
import type { OnboardingRepository } from '../domain/onboarding-repository';
import { openCondo } from '../domain/open-condo';

import { GroundStep } from './ground-step';
import { ResidentSheet } from './resident-sheet';
import type { AccessCardSlot, AccessInvitations, BuildingViewSlot } from './slots';

type Props = {
  building: Pick<BuildingRepository, 'get'>;
  categories: CategoryRepository;
  accounts: Pick<AccountRepository, 'save'>;
  settings: SettingsRepository;
  residents: Pick<ResidentRepository, 'save' | 'getById'>;
  invitations: AccessInvitations;
  onboarding: OnboardingRepository;
  onDone: () => void;
  buildingView: BuildingViewSlot;
  accessCard: AccessCardSlot;
  headerAction?: ReactNode;
};

type Step = 'residents' | 'ground';

const onboardingCategoriesKey = ['onboarding', 'categories'] as const;

function Question({ children }: { children: string }) {
  return (
    <h1
      style={{
        margin: '8px 0 16px',
        fontFamily: "'Fraunces', serif",
        fontSize: '1.35rem',
        lineHeight: 1.25,
        color: 'var(--petrol-900)',
      }}
    >
      {children}
    </h1>
  );
}

type Attempt = { plan: GroundPlan; existing: readonly Category[]; today: string };

function useLeaveOnce(onDone: () => void): () => void {
  const left = useRef(false);
  return useCallback(() => {
    if (left.current) return;
    left.current = true;
    useCondoScope.getState().completeOnboarding();
    onDone();
  }, [onDone]);
}

function useOpenCondo(props: Props, condoId: string | null, condoName: string, leave: () => void) {
  const queryClient = useQueryClient();
  const frozen = useRef<Attempt | null>(null);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const categories = useQuery({
    queryKey: onboardingCategoriesKey,
    queryFn: () => props.categories.list(),
  });

  const freshAttempt = (form: GroundForm): Attempt => {
    const existing = categories.data ?? [];
    const today = todayIso();
    const plan = planGround(
      groundInputFromForm(form),
      existing.map((category) => category.name),
      today,
    );
    return { plan, existing, today };
  };

  const open = async (form: GroundForm) => {
    if (condoId === null) return;
    const attempt = frozen.current ?? freshAttempt(form);
    setSaving(true);
    setFailed(false);
    try {
      await openCondo(
        attempt.plan,
        { ...props, existingCategories: attempt.existing, today: attempt.today, condoId },
        () => {
          frozen.current = attempt;
          setLocked(true);
        },
      );
    } catch {
      setFailed(true);
      setSaving(false);
      return;
    }
    await queryClient.invalidateQueries();
    leave();
  };

  return { categories, open, saving, failed, locked, label: `Abrir o ${condoName}` };
}

function useLeaveWhenOpenedElsewhere(
  onboarding: Pick<OnboardingRepository, 'isPending'>,
  condoId: string | null,
  leave: () => void,
) {
  const pending = useQuery({
    queryKey: ['onboarding', 'pending', condoId],
    queryFn: () => onboarding.isPending(condoId ?? ''),
    enabled: condoId !== null,
  });
  const openedElsewhere = pending.data === false;
  useEffect(() => {
    if (openedElsewhere) leave();
  }, [openedElsewhere, leave]);
}

export function OnboardingFlow(props: Props) {
  const { building, residents, invitations, buildingView: BuildingView, accessCard } = props;
  const condoId = useCondoScope((state) => state.condo?.id ?? null);
  const condoName = useCondoScope((state) => state.condo?.name ?? '');
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('residents');
  const [selected, setSelected] = useState<BuildingApartment | null>(null);
  const [form, setForm] = useState<GroundForm | null>(null);
  const leave = useLeaveOnce(props.onDone);
  const opening = useOpenCondo(props, condoId, condoName, leave);
  useLeaveWhenOpenedElsewhere(props.onboarding, condoId, leave);
  const drawing = useQuery({
    queryKey: buildingQueryKey(condoId ?? ''),
    queryFn: () => building.get(),
    enabled: condoId !== null,
  });

  const loadedNames = opening.categories.data?.map((category) => category.name);
  const groundForm = form ?? (loadedNames ? initialGroundForm(loadedNames) : null);

  const ground =
    step !== 'ground' ? undefined : groundForm ? (
      <fieldset disabled={opening.locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <GroundStep form={groundForm} onChange={setForm} />
      </fieldset>
    ) : opening.categories.isError ? (
      <FormError message="Não foi possível carregar as contas." />
    ) : (
      <p role="status" style={{ color: 'var(--ink-500)' }}>
        Carregando…
      </p>
    );

  return (
    <Screen>
      <ScreenBody>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 12 }}>
          {props.headerAction && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{props.headerAction}</div>
          )}
          <Question>
            {step === 'residents'
              ? `Pronto, esse é o ${condoName}. Quem mora em cada um?`
              : 'Quais contas o prédio paga, e quanto tem em caixa hoje?'}
          </Question>
          {drawing.isError && (
            <StatusView
              variant="error"
              message="Não foi possível carregar o prédio."
              onRetry={() => void drawing.refetch()}
            />
          )}
          {drawing.isPending && !drawing.isError && (
            <p role="status" style={{ color: 'var(--ink-500)' }}>
              Carregando o prédio…
            </p>
          )}
          {drawing.data && (
            <BuildingView building={drawing.data} onSelectApartment={setSelected} ground={ground} />
          )}
          {selected && (
            <ResidentSheet
              key={selected.id}
              apartment={selected}
              residents={residents}
              invitations={invitations}
              accessCard={accessCard}
              onSaved={() =>
                void queryClient.invalidateQueries({ queryKey: buildingQueryKey(condoId ?? '') })
              }
              onClose={() => setSelected(null)}
            />
          )}
          {step === 'residents' ? (
            <PrimaryButton
              onClick={() => {
                setSelected(null);
                setStep('ground');
              }}
            >
              Agora as contas
            </PrimaryButton>
          ) : (
            <>
              <FormError
                message={opening.failed ? 'Não foi possível salvar. Tente de novo.' : null}
              />
              <PrimaryButton
                disabled={groundForm === null || opening.saving}
                onClick={() => {
                  if (groundForm) void opening.open(groundForm);
                }}
              >
                {opening.saving ? 'Abrindo…' : opening.label}
              </PrimaryButton>
            </>
          )}
        </div>
      </ScreenBody>
    </Screen>
  );
}
