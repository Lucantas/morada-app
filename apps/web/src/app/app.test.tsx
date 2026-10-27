import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSessionStore } from '@/features/session/ui/session-store';
import { useCondoScope } from '@/shared/lib/condo-scope';

import { App } from './app';
import { authRepository } from './container';
import { testCondo } from '@/test/condo';

jest.mock('./container', () => {
  const { InMemoryReceiptRepository } = jest.requireActual(
    '@/features/receipts/data/in-memory-receipt-repository',
  );
  const { buildResident: build } = jest.requireActual('@/test/factories');
  const unused = {};
  const { fakeAuthRepository } = jest.requireActual('@/test/factories.auth');
  return {
    authRepository: fakeAuthRepository(),
    residentRepository: {
      getCurrent: async () => build({ id: 'r-1', name: 'Maria Ribeiro' }),
    },
    receiptRepository: new InMemoryReceiptRepository([]),
    accountRepository: unused,
    categoryRepository: unused,
    condoInfoRepository: unused,
    dashboardRepository: unused,
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

const repository = jest.mocked(authRepository);

describe('App router', () => {
  afterEach(() => {
    act(() => useSessionStore.getState().signOut());
    window.history.replaceState(null, '', '/');
    jest.clearAllMocks();
  });

  test('renders the resident home for a resident session with a condominium', async () => {
    act(() => {
      useCondoScope.getState().setCondo(testCondo({ name: 'Residencial Ipê' }));
      useSessionStore.getState().authenticate('resident', 'r-1');
    });

    render(<App />);

    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
  });

  test('switches from minha casa to o prédio for a staff person with a home', async () => {
    const user = userEvent.setup();
    act(() => {
      useCondoScope.getState().setCondo(testCondo({ hasHome: true }));
      useSessionStore.getState().authenticate('resident', null);
    });
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'O prédio' }));

    expect(useSessionStore.getState().role).toBe('admin');
    expect(await screen.findByText('Painel do administrador')).toBeInTheDocument();
  });

  test('signing out from the onboarding conversation clears its draft', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'morada-onboarding-draft',
      JSON.stringify({ answers: [{ question: 'name', name: 'Ipê', text: 'Ipê' }] }),
    );
    act(() => useSessionStore.setState({ pendingUser: { emailVerified: true } }));
    render(<App />);

    expect(screen.getByText('Ele tem blocos ou é um prédio só?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(window.localStorage.getItem('morada-onboarding-draft')).toBeNull();
  });

  test('shows the login screen when signed out', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  test('signs in with the typed login and lands in the app', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('E-mail ou usuário'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(repository.login).toHaveBeenCalledWith('ana@exemplo.com', 'segredo123');
    await waitFor(() => expect(useSessionStore.getState().role).toBe('admin'));
  });
});
