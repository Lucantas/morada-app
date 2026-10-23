import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccountError } from '@/features/account/domain/errors';

import { useSessionStore } from '@/features/session/ui/session-store';
import { useCondoScope } from '@/shared/lib/condo-scope';

import { App } from './app';
import { userAccountRepository } from './container';

jest.mock('./container', () => {
  const { InMemoryReceiptRepository } = jest.requireActual(
    '@/features/receipts/data/in-memory-receipt-repository',
  );
  const { buildResident: build } = jest.requireActual('@/test/factories');
  const unused = {};
  const { fakeUserAccountRepository } = jest.requireActual('@/test/factories.account');
  return {
    userAccountRepository: fakeUserAccountRepository(),
    residentRepository: {
      getCurrent: async () => build({ id: 'r-1', name: 'Maria Ribeiro' }),
    },
    receiptRepository: new InMemoryReceiptRepository([]),
    accountRepository: unused,
    categoryRepository: unused,
    condoInfoRepository: unused,
    dashboardRepository: unused,
    incomeRepository: unused,
    noticeRepository: unused,
    settingsRepository: unused,
    confirmPayment: jest.fn(),
    editReceipt: jest.fn(),
    ensureMonthlyReceipts: jest.fn(),
    getResidentLogin: jest.fn(),
    issueCharge: jest.fn(),
    logout: jest.fn(),
    overrideResidentStatus: jest.fn(),
    provisionResidentLogin: jest.fn(),
    registerPayment: jest.fn(),
    rejectPayment: jest.fn(),
    resetResidentLogin: jest.fn(),
  };
});

const TOKEN = 'abcDEF0123456789_-xyzABCDEF0123456789abcde';
const repository = jest.mocked(userAccountRepository);

describe('App router', () => {
  afterEach(() => {
    act(() => useSessionStore.getState().signOut());
    window.history.replaceState(null, '', '/');
    jest.clearAllMocks();
  });

  test('renders the resident home for a resident session with a condominium', async () => {
    act(() => {
      useCondoScope.getState().setCondo({ id: 'c1', name: 'Residencial Ipê' });
      useSessionStore.getState().authenticate('resident', 'r-1');
    });

    render(<App />);

    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
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

  test('shows the invalid-credentials message on a failed login', async () => {
    repository.login.mockRejectedValueOnce(new AccountError('invalid-credentials'));
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('E-mail ou usuário'), 'ana');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.');
  });

  test('switches between the login, sign-up and forgot-password entries', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Já tenho conta' }));
    await user.click(screen.getByRole('button', { name: 'Esqueci a senha' }));
    expect(screen.getByRole('heading', { name: 'Esqueci a senha' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Voltar para o login' }));
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  test('a login with zero condos and an unconfirmed e-mail shows the pending screen', async () => {
    repository.login.mockResolvedValueOnce({ condos: [], emailVerified: false });
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('E-mail ou usuário'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
  });

  test('a confirmed account without condos creates one and lands as admin', async () => {
    act(() => {
      useSessionStore.getState().signOut();
    });
    const user = userEvent.setup();
    act(() => {
      useSessionStore.setState({ account: { emailVerified: true } });
    });
    render(<App />);

    await user.type(screen.getByLabelText('Nome do condomínio'), 'Edifício Sol');
    await user.click(screen.getByRole('button', { name: 'Criar condomínio' }));

    await waitFor(() => expect(useSessionStore.getState().role).toBe('admin'));
    expect(useSessionStore.getState().account).toBeNull();
    expect(useCondoScope.getState().condo).toEqual({ id: 'c9', name: 'Edifício Sol' });
  });

  test('a confirmation link renders before any session view and lands in the app', async () => {
    act(() => {
      useSessionStore.setState({ account: { emailVerified: false } });
    });
    window.history.replaceState(null, '', `/#/confirmar-email/${TOKEN}`);
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Confirmar e-mail' }));

    expect(repository.confirmEmail).toHaveBeenCalledWith(TOKEN, 'segredo123');
    await waitFor(() => expect(useSessionStore.getState().role).toBe('admin'));
    expect(window.location.hash).toBe('');
  });

  test('a reset link renders the reset screen', () => {
    window.history.replaceState(null, '', `/#/redefinir-senha/${TOKEN}`);

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument();
  });

  test('a reset link can ask for a new link through the forgot-password entry', async () => {
    repository.resetPassword.mockRejectedValueOnce(new AccountError('invalid-link'));
    window.history.replaceState(null, '', `/#/redefinir-senha/${TOKEN}`);
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Nova senha'), 'novasenha1');
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'novasenha1');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    await user.click(await screen.findByRole('button', { name: 'Pedir um novo link' }));

    expect(screen.getByRole('heading', { name: 'Esqueci a senha' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });
});
