import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthError } from '@/features/auth/domain/errors';
import { useSessionStore } from '@/features/session/ui/session-store';
import { useCondoScope } from '@/shared/lib/condo-scope';
import { fakeAuthRepository } from '@/test/factories.auth';
import { renderWithClient } from '@/test/render';

import { EntryRouter } from './entry-router';

const TOKEN = 'abcDEF0123456789_-xyzABCDEF0123456789abcde';
const OTHER_TOKEN = 'zyxDEF0123456789_-xyzABCDEF0123456789abcde';

function renderEntry(repository = fakeAuthRepository()) {
  const props = { repository, onLanded: jest.fn(), onSignOut: jest.fn() };
  renderWithClient(
    <EntryRouter {...props}>
      <p>Área logada</p>
    </EntryRouter>,
  );
  return props;
}

async function signIn(login = 'ana@exemplo.com', password = 'segredo123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail ou usuário'), login);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  return user;
}

describe('EntryRouter', () => {
  afterEach(() => {
    act(() => useSessionStore.getState().signOut());
    window.history.replaceState(null, '', '/');
  });

  test('renders the signed-in app when a role is set', () => {
    act(() => {
      useCondoScope.getState().setCondo({ id: 'c1', name: 'Morada' });
      useSessionStore.getState().authenticate('admin', null);
    });

    renderEntry();

    expect(screen.getByText('Área logada')).toBeInTheDocument();
  });

  test('signs in with the typed login and lands in the app', async () => {
    const { repository, onLanded } = renderEntry();

    await signIn();

    expect(repository.login).toHaveBeenCalledWith('ana@exemplo.com', 'segredo123');
    await waitFor(() => expect(onLanded).toHaveBeenCalledWith('admin'));
    expect(screen.getByText('Área logada')).toBeInTheDocument();
  });

  test('shows the invalid-credentials message on a failed login', async () => {
    renderEntry(
      fakeAuthRepository({
        login: jest.fn().mockRejectedValue(new AuthError('invalid-credentials')),
      }),
    );

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.');
  });

  test('clears the login error when switching entries', async () => {
    renderEntry(
      fakeAuthRepository({
        login: jest.fn().mockRejectedValue(new AuthError('invalid-credentials')),
      }),
    );
    const user = await signIn();
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await user.click(screen.getByRole('button', { name: 'Já tenho conta' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('switches between the login, sign-up and forgot-password entries', async () => {
    const user = userEvent.setup();
    renderEntry();

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Já tenho conta' }));
    await user.click(screen.getByRole('button', { name: 'Esqueci a senha' }));
    expect(screen.getByRole('heading', { name: 'Esqueci a senha' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Voltar para o login' }));
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  test('a login with zero condos and an unconfirmed e-mail shows the pending screen', async () => {
    const { onLanded } = renderEntry(
      fakeAuthRepository({
        login: jest.fn().mockResolvedValue({ condos: [], emailVerified: false }),
      }),
    );

    await signIn();

    expect(await screen.findByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
    expect(onLanded).not.toHaveBeenCalled();
  });

  test('the pending screen signs out', async () => {
    act(() => useSessionStore.setState({ pendingUser: { emailVerified: false } }));
    const { onSignOut } = renderEntry();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onSignOut).toHaveBeenCalled();
  });

  test('a confirmed user without condos creates one and lands as admin', async () => {
    act(() => useSessionStore.setState({ pendingUser: { emailVerified: true } }));
    const { onLanded } = renderEntry();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nome do condomínio'), 'Edifício Sol');
    await user.click(screen.getByRole('button', { name: 'Criar condomínio' }));

    await waitFor(() => expect(onLanded).toHaveBeenCalledWith('admin'));
    expect(useSessionStore.getState()).toMatchObject({ role: 'admin', pendingUser: null });
    expect(useCondoScope.getState().condo).toEqual({ id: 'c9', name: 'Edifício Sol' });
  });

  test('a confirmation link renders before any session view and lands in the app', async () => {
    act(() => useSessionStore.setState({ pendingUser: { emailVerified: false } }));
    window.history.replaceState(null, '', `/#/confirmar-email/${TOKEN}`);
    const { repository, onLanded } = renderEntry();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Confirmar e-mail' }));

    expect(repository.confirmEmail).toHaveBeenCalledWith(TOKEN, 'segredo123');
    await waitFor(() => expect(onLanded).toHaveBeenCalledWith('admin'));
    expect(window.location.hash).toBe('');
  });

  test('a reset link renders the reset screen', () => {
    window.history.replaceState(null, '', `/#/redefinir-senha/${TOKEN}`);

    renderEntry();

    expect(screen.getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument();
  });

  test('a reset link can ask for a new link through the forgot-password entry', async () => {
    window.history.replaceState(null, '', `/#/redefinir-senha/${TOKEN}`);
    renderEntry(
      fakeAuthRepository({
        resetPassword: jest.fn().mockRejectedValue(new AuthError('invalid-link')),
      }),
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nova senha'), 'novasenha1');
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'novasenha1');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    await user.click(await screen.findByRole('button', { name: 'Pedir um novo link' }));

    expect(screen.getByRole('heading', { name: 'Esqueci a senha' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  test('a public link opened in an already-loaded tab renders its screen', async () => {
    const { repository } = renderEntry();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();

    act(() => {
      window.history.replaceState(null, '', `/#/redefinir-senha/${TOKEN}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument();

    act(() => {
      window.history.replaceState(null, '', `/#/confirmar-email/${OTHER_TOKEN}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Confirmar e-mail' }));

    expect(repository.confirmEmail).toHaveBeenCalledWith(OTHER_TOKEN, 'segredo123');
  });

  test('stops listening to hash changes after unmount', () => {
    const remove = jest.spyOn(window, 'removeEventListener');
    renderWithClient(
      <EntryRouter repository={fakeAuthRepository()} onLanded={jest.fn()} onSignOut={jest.fn()}>
        <p>Área logada</p>
      </EntryRouter>,
    ).unmount();

    expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
    remove.mockRestore();
  });
});
