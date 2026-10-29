import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSessionStore, applyLogin } from '@/features/session/ui/session-store';
import { useCondoScope } from '@/shared/lib/condo-scope';
import { loginCondo } from '@/test/factories.auth';

import { App } from './app';

jest.mock('./container', () => {
  const { InMemoryReceiptRepository } = jest.requireActual(
    '@/features/receipts/data/in-memory-receipt-repository',
  );
  const { buildResident: build } = jest.requireActual('@/test/factories');
  const { useCondoScope: scope } = jest.requireActual('@/shared/lib/condo-scope');
  const { fakeAuthRepository, loginCondo: condoOf } = jest.requireActual('@/test/factories.auth');
  const unused = {};
  const pendencies = {
    overdueResidents: 1,
    overdueAccounts: 0,
    accountsDueSoon: 0,
    proofsToReview: 0,
    unreadThreads: 0,
  };
  const windows = [{ block: null, floor: 1, position: 1, lit: true }];
  return {
    authRepository: fakeAuthRepository({
      createCondo: jest
        .fn()
        .mockResolvedValue(condoOf({ id: 'c9', name: 'Edifício Sol', onboardingPending: true })),
    }),
    streetRepository: {
      get: async () => ({
        name: 'Lucas',
        condos: [
          { ...condoOf({ id: 'a', name: 'Alfa' }), pendencies, windows },
          { ...condoOf({ id: 'b', name: 'Beta' }), pendencies, windows },
        ],
        homes: [],
      }),
    },
    residentRepository: {
      list: async () => {
        const id = scope.getState().condo?.id;
        if (id === 'b') await new Promise((resolve) => setTimeout(resolve, 150));
        return [build({ id: `r-${id}`, name: id === 'a' ? 'Morador do Alfa' : 'Morador do Beta' })];
      },
    },
    receiptRepository: new InMemoryReceiptRepository([]),
    accountRepository: unused,
    buildingRepository: { get: async () => ({ blocks: [], unplaced: [] }) },
    onboardingRepository: unused,
    categoryRepository: { list: async () => [] },
    condoInfoRepository: unused,
    dashboardRepository: { getSummary: () => new Promise(() => undefined) },
    incomeRepository: unused,
    invitationRepository: unused,
    noticeRepository: unused,
    settingsRepository: unused,
    confirmPayment: jest.fn(),
    editReceipt: jest.fn(),
    ensureMonthlyReceipts: jest.fn(),
    issueCharge: jest.fn(),
    logout: jest.fn(),
    overrideResidentStatus: jest.fn(),
    registerPayment: jest.fn(),
    rejectPayment: jest.fn(),
  };
});

function landAtStreet() {
  act(() => {
    applyLogin({
      condos: [loginCondo({ id: 'a', name: 'Alfa' }), loginCondo({ id: 'b', name: 'Beta' })],
      emailVerified: true,
    });
  });
}

describe('App street', () => {
  afterEach(() => {
    act(() => useSessionStore.getState().signOut());
    window.history.replaceState(null, '', '/');
    jest.clearAllMocks();
  });

  test('switching from the street to condo B never shows condo A residents', async () => {
    const user = userEvent.setup();
    landAtStreet();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /^Alfa, 1 apartamento/ }));
    await user.click(await screen.findByRole('button', { name: 'Apartamentos' }));
    expect(await screen.findByText(/Morador do Alfa/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Início' }));

    await user.click(await screen.findByRole('button', { name: 'Seus condomínios' }));
    await user.click(await screen.findByRole('button', { name: /^Beta, 1 apartamento/ }));
    await user.click(await screen.findByRole('button', { name: 'Apartamentos' }));

    expect(screen.queryByText(/Morador do Alfa/)).not.toBeInTheDocument();
    expect(await screen.findByText(/Morador do Beta/)).toBeInTheDocument();
    expect(screen.queryByText(/Morador do Alfa/)).not.toBeInTheDocument();
  });

  test('creating a condo from the street enters its onboarding', async () => {
    const user = userEvent.setup();
    landAtStreet();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: '+ Novo condomínio' }));
    await user.type(screen.getByLabelText('Nome do condomínio'), 'Edifício Sol');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(screen.getByRole('button', { name: 'Só um prédio' }));
    await user.type(screen.getByLabelText('Andares'), '2');
    await user.type(screen.getByLabelText('Apartamentos por andar'), '2');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(screen.getByRole('button', { name: 'Depois eu vejo' }));
    await user.click(screen.getByRole('button', { name: 'Depois eu vejo' }));
    await user.click(screen.getByRole('button', { name: 'Criar o Edifício Sol' }));

    expect(
      await screen.findByText('Pronto, esse é o Edifício Sol. Quem mora em cada um?'),
    ).toBeInTheDocument();
    expect(useCondoScope.getState().atStreet).toBe(false);
    expect(useCondoScope.getState().condoCount).toBe(3);
  });

  test('going back from the new condo conversation returns to the street', async () => {
    const user = userEvent.setup();
    landAtStreet();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: '+ Novo condomínio' }));
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(await screen.findByRole('list', { name: 'Rua de condomínios' })).toBeInTheDocument();
  });
});
