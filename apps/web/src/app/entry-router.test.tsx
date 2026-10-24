import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthError } from '@/features/auth/domain/errors';
import { InvitationError } from '@/features/invitations/domain/errors';
import { useSessionStore } from '@/features/session/ui/session-store';
import { useCondoScope } from '@/shared/lib/condo-scope';
import { fakeAuthRepository } from '@/test/factories.auth';
import {
  SINDICO_PREVIEW,
  TEAM_PREVIEW,
  fakeInvitationRepository,
} from '@/test/factories.invitations';
import { loginCondo } from '@/test/factories.auth';
import { renderWithClient } from '@/test/render';

import { EntryRouter } from './entry-router';
import { testCondo } from '@/test/condo';

const TOKEN = 'abcDEF0123456789_-xyzABCDEF0123456789abcde';
const OTHER_TOKEN = 'zyxDEF0123456789_-xyzABCDEF0123456789abcde';

function renderEntry(repository = fakeAuthRepository(), invitations = fakeInvitationRepository()) {
  const props = { repository, invitations, onLanded: jest.fn(), onSignOut: jest.fn() };
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
      useCondoScope.getState().setCondo(testCondo({ name: 'Morada' }));
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
    expect(useCondoScope.getState().condo).toMatchObject({ id: 'c9', name: 'Edifício Sol' });
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

  test('an invite link clears the URL at once and keeps the token for the accept', async () => {
    window.history.replaceState(null, '', `/#/convite/${TOKEN}`);
    const { invitations, onLanded } = renderEntry();
    const user = userEvent.setup();

    expect(window.location.hash).toBe('');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Seu nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(invitations.preview).toHaveBeenCalledWith(TOKEN);
    expect(invitations.accept).toHaveBeenCalledWith(TOKEN, expect.anything());
    await waitFor(() => expect(onLanded).toHaveBeenCalledWith('resident'));
    expect(screen.getByText('Área logada')).toBeInTheDocument();
  });

  test('an accepted invite awaiting e-mail confirmation shows the pending screen', async () => {
    window.history.replaceState(null, '', `/#/convite/${TOKEN}`);
    const { onLanded } = renderEntry(
      fakeAuthRepository(),
      fakeInvitationRepository({
        accept: jest.fn().mockResolvedValue({ condos: [], emailVerified: false }),
      }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Seu nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enviamos um link para confirmar seu e-mail. Depois de confirmar, o acesso ao Condomínio Morada é liberado.',
      ),
    ).toBeInTheDocument();
    expect(onLanded).not.toHaveBeenCalled();
  });

  test('accepting a team invite never stores the organization name as a condominium name', async () => {
    window.history.replaceState(null, '', `/#/convite/${TOKEN}`);
    renderEntry(
      fakeAuthRepository(),
      fakeInvitationRepository({
        preview: jest.fn().mockResolvedValue(TEAM_PREVIEW),
        accept: jest.fn().mockResolvedValue({ condos: [], emailVerified: false }),
      }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
    expect(screen.queryByText(/Administradora Aurora/)).not.toBeInTheDocument();
  });

  test('accepting a team invite lands on the real condominium from the response', async () => {
    window.history.replaceState(null, '', `/#/convite/${TOKEN}`);
    const { onLanded } = renderEntry(
      fakeAuthRepository(),
      fakeInvitationRepository({
        preview: jest.fn().mockResolvedValue(TEAM_PREVIEW),
        accept: jest.fn().mockResolvedValue({
          condos: [loginCondo({ id: 'c7', name: 'Edifício Real' })],
          emailVerified: true,
        }),
      }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    await waitFor(() => expect(onLanded).toHaveBeenCalledWith('admin'));
    expect(useCondoScope.getState().condo?.name).toBe('Edifício Real');
  });

  test('accepting a síndico invite lands on the invited condominium, not the first', async () => {
    window.history.replaceState(null, '', `/#/convite/${TOKEN}`);
    const { onLanded } = renderEntry(
      fakeAuthRepository(),
      fakeInvitationRepository({
        preview: jest.fn().mockResolvedValue({ ...SINDICO_PREVIEW, accountExists: true }),
        accept: jest.fn().mockResolvedValue({
          condos: [
            loginCondo({ id: 'c1', name: 'Primeiro', role: 'resident', condoRole: 'morador' }),
            loginCondo({ id: 'c9', name: 'Convidado', condoRole: 'sindico' }),
          ],
          emailVerified: true,
          invitedCondoId: 'c9',
        }),
      }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    await waitFor(() => expect(onLanded).toHaveBeenCalledWith('admin'));
    expect(useCondoScope.getState().condo).toMatchObject({ id: 'c9', name: 'Convidado' });
  });

  test('"Esqueci a senha" on an invite opens the forgot-password screen', async () => {
    window.history.replaceState(null, '', `/#/convite/${TOKEN}`);
    renderEntry();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Esqueci a senha' }));

    expect(screen.getByRole('heading', { name: 'Esqueci a senha' })).toBeInTheDocument();
  });

  test('an invalid invite goes back to the login', async () => {
    window.history.replaceState(null, '', `/#/convite/${TOKEN}`);
    renderEntry(
      fakeAuthRepository(),
      fakeInvitationRepository({
        preview: jest.fn().mockRejectedValue(new InvitationError('invalid-invitation')),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Ir para o login' }));

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  test('stops listening to hash changes after unmount', () => {
    const remove = jest.spyOn(window, 'removeEventListener');
    renderWithClient(
      <EntryRouter
        repository={fakeAuthRepository()}
        invitations={fakeInvitationRepository()}
        onLanded={jest.fn()}
        onSignOut={jest.fn()}
      >
        <p>Área logada</p>
      </EntryRouter>,
    ).unmount();

    expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
    remove.mockRestore();
  });
});
