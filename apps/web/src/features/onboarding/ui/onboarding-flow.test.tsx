import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/features/accounts/domain/account';
import type { Building } from '@/features/building/domain/building';
import { BuildingView } from '@/features/building/ui/building-view';
import type { Category } from '@/features/categories/domain/category';
import { ResidentAccessCard } from '@/features/invitations/ui/resident-access-card';
import type { Resident } from '@/features/residents/domain/resident';
import type { CondoSettings } from '@/features/settings/domain/condo-settings';
import { useCondoScope } from '@/shared/lib/condo-scope';
import { testCondo } from '@/test/condo';
import { fakeInvitationRepository } from '@/test/factories.invitations';
import { renderWithClient } from '@/test/render';

import { OnboardingFlow } from './onboarding-flow';

const LABELS = ['Apto 101', 'Apto 102'];
const CATEGORIES: Category[] = [
  { id: 'c-1', name: 'Água', keywords: '', position: 0 },
  { id: 'c-2', name: 'Energia', keywords: '', position: 1 },
  { id: 'c-3', name: 'Serviços', keywords: '', position: 2 },
];
const SETTINGS: CondoSettings = {
  monthlyFeeCents: 35000,
  dueDay: 10,
  pix: null,
  openingBalance: null,
};

function setup({ buildingFails = false } = {}) {
  let residents: readonly Resident[] = [];
  const residentRepository = {
    save: jest.fn(async (resident: Resident) => {
      residents = [...residents, resident];
      return resident;
    }),
    getById: jest.fn(async (id: string) => residents.find((item) => item.id === id) ?? null),
  };
  const building = {
    get: jest.fn(async (): Promise<Building> => {
      if (buildingFails) throw new Error('falhou');
      return {
        blocks: [
          {
            name: null,
            floors: [
              {
                floor: 1,
                apartments: LABELS.map((label) => {
                  const resident = residents.find((item) => item.apt === label);
                  return {
                    id: label,
                    label,
                    state: resident ? ('ocupado' as const) : ('vazio' as const),
                    residentId: resident?.id ?? null,
                    residentName: resident?.name ?? null,
                  };
                }),
              },
            ],
          },
        ],
        unplaced: [],
      };
    }),
  };
  const props = {
    building,
    categories: {
      list: jest.fn(async () => CATEGORIES),
      save: jest.fn(async () => ({ categories: CATEGORIES, reclassified: 0 })),
    },
    accounts: { save: jest.fn(async (account: Account) => account) },
    settings: {
      get: jest.fn(async () => SETTINGS),
      save: jest.fn(async () => SETTINGS),
    },
    residents: residentRepository,
    invitations: fakeInvitationRepository(),
    onboarding: { complete: jest.fn(async () => undefined) },
    onDone: jest.fn(),
    buildingView: BuildingView,
    accessCard: ResidentAccessCard,
  };
  renderWithClient(<OnboardingFlow {...props} />);
  return props;
}

async function goToGround(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Agora as contas' }));
  await screen.findByText('Quais contas o prédio paga, e quanto tem em caixa hoje?');
  await screen.findByRole('group', { name: 'Contas' });
}

beforeEach(() => {
  act(() => useCondoScope.getState().setCondo(testCondo({ onboardingPending: true })));
});

describe('OnboardingFlow', () => {
  test('adding a resident lights the window', async () => {
    const user = userEvent.setup();
    const props = setup();

    expect(
      screen.getByText('Pronto, esse é o Residencial Ipê. Quem mora em cada um?'),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Apto 101 · vazio' }));
    await user.type(screen.getByLabelText('Nome'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByRole('button', { name: 'Apto 101 · ocupado por Ana' }),
    ).toBeInTheDocument();
    expect(props.residents.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana', apt: 'Apto 101', status: 'em_dia' }),
    );
    expect(await screen.findByRole('button', { name: 'Gerar convite' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('button', { name: 'Gerar convite' })).not.toBeInTheDocument();
  });

  test('tapping an occupied window reopens the access card', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole('button', { name: 'Apto 101 · vazio' }));
    await user.type(screen.getByLabelText('Nome'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await user.click(await screen.findByRole('button', { name: 'Fechar' }));
    await user.click(screen.getByRole('button', { name: 'Apto 101 · ocupado por Ana' }));

    expect(await screen.findByRole('button', { name: 'Gerar convite' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });

  test('skipping everything just completes', async () => {
    const user = userEvent.setup();
    const props = setup();
    await goToGround(user);

    const gasto = within(screen.getByRole('group', { name: 'Gasto no mês' }));
    const caixa = within(screen.getByRole('group', { name: 'Em caixa hoje' }));
    await user.click(gasto.getByRole('button', { name: 'Depois eu vejo' }));
    await user.click(caixa.getByRole('button', { name: 'Depois eu vejo' }));
    await user.click(screen.getByRole('button', { name: 'Abrir o Residencial Ipê' }));

    await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
    expect(props.onboarding.complete).toHaveBeenCalledTimes(1);
    expect(props.categories.save).not.toHaveBeenCalled();
    expect(props.accounts.save).not.toHaveBeenCalled();
    expect(props.settings.save).not.toHaveBeenCalled();
    expect(useCondoScope.getState().condo?.onboardingPending).toBe(false);
  });

  test('save failure keeps the step and retries only the rest', async () => {
    const user = userEvent.setup();
    const props = setup();
    props.settings.save.mockRejectedValueOnce(new Error('falhou'));
    await goToGround(user);

    const gasto = within(screen.getByRole('group', { name: 'Gasto no mês' }));
    const caixa = within(screen.getByRole('group', { name: 'Em caixa hoje' }));
    await user.type(gasto.getByLabelText('Água'), '34800');
    await user.type(caixa.getByLabelText('Valor em caixa'), '1230000');
    await user.click(screen.getByRole('button', { name: 'Abrir o Residencial Ipê' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Tente de novo.',
    );
    expect(
      screen.getByText('Quais contas o prédio paga, e quanto tem em caixa hoje?'),
    ).toBeInTheDocument();
    expect(props.accounts.save).toHaveBeenCalledTimes(1);
    expect(props.onboarding.complete).not.toHaveBeenCalled();
    expect(props.onDone).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Abrir o Residencial Ipê' }));

    await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
    expect(props.accounts.save).toHaveBeenCalledTimes(1);
    expect(props.accounts.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringMatching(/^Água de /),
        category: 'Água',
        valueCents: 34800,
        status: 'pago',
      }),
    );
    expect(props.settings.save).toHaveBeenCalledTimes(2);
    expect(props.settings.save).toHaveBeenLastCalledWith({
      monthlyFeeCents: 35000,
      dueDay: 10,
      openingBalance: { valueCents: 1_264_800, date: expect.any(String) },
    });
    expect(props.onboarding.complete).toHaveBeenCalledTimes(1);
  });

  test('a building that cannot load shows an error', async () => {
    setup({ buildingFails: true });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o prédio.',
    );
  });
});
