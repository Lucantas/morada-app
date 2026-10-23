import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  OPEN_PREVIEW,
  RESIDENT_LOGIN,
  fakeInvitationRepository,
} from '@/test/factories.invitations';
import { renderWithClient } from '@/test/render';

import { InvitationError } from '../domain/errors';

import { AcceptInviteScreen } from './accept-invite-screen';

const EMAIL_PREVIEW = { ...OPEN_PREVIEW, email: 'ana@exemplo.com' };

function renderAccept(repository = fakeInvitationRepository()) {
  const props = { token: 'tok-123', repository, onAccepted: jest.fn(), onSignIn: jest.fn() };
  renderWithClient(<AcceptInviteScreen {...props} />);
  return props;
}

function withPreview(preview: typeof OPEN_PREVIEW, overrides = {}) {
  return fakeInvitationRepository({ preview: jest.fn().mockResolvedValue(preview), ...overrides });
}

describe('AcceptInviteScreen', () => {
  test('shows who is invited to which condominium', async () => {
    renderAccept();

    expect(
      await screen.findByRole('heading', { name: 'Você foi convidado para o Condomínio Morada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana Souza · Apto 302')).toBeInTheDocument();
  });

  test('an open invite always sends e-mail, name and password', async () => {
    const { repository, onAccepted } = renderAccept();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail'), 'Ana@Exemplo.com');
    await user.type(screen.getByLabelText('Seu nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(repository.accept).toHaveBeenCalledWith('tok-123', {
      email: 'ana@exemplo.com',
      name: 'Ana Souza',
      password: 'segredo123',
    });
    expect(onAccepted).toHaveBeenCalledWith(RESIDENT_LOGIN, 'Condomínio Morada');
  });

  test('an open invite validates the password length before calling the API', async () => {
    const { repository } = renderAccept();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Seu nome'), 'Ana');
    await user.type(screen.getByLabelText('Senha'), '123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A senha precisa ter pelo menos 8 caracteres.',
    );
    expect(repository.accept).not.toHaveBeenCalled();
  });

  test('an existing account only types its password, with the e-mail locked', async () => {
    const { repository } = renderAccept(withPreview({ ...EMAIL_PREVIEW, accountExists: true }));
    const user = userEvent.setup();

    expect(await screen.findByText('Entre com a senha da sua conta')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@exemplo.com');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Seu nome')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Senha'), 'minha-senha');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(repository.accept).toHaveBeenCalledWith('tok-123', { password: 'minha-senha' });
  });

  test('a wrong password for an existing account is explained', async () => {
    renderAccept(
      withPreview(
        { ...EMAIL_PREVIEW, accountExists: true },
        { accept: jest.fn().mockRejectedValue(new InvitationError('invalid-credentials')) },
      ),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.');
  });

  test('a new account with e-mail asks name, password and confirmation', async () => {
    const { repository } = renderAccept(withPreview(EMAIL_PREVIEW));
    const user = userEvent.setup();

    expect(await screen.findByLabelText('E-mail')).toHaveValue('ana@exemplo.com');
    await user.type(screen.getByLabelText('Seu nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.type(screen.getByLabelText('Confirme a senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(repository.accept).toHaveBeenCalledWith('tok-123', {
      name: 'Ana Souza',
      password: 'segredo123',
    });
  });

  test('a mismatched confirmation is caught before calling the API', async () => {
    const { repository } = renderAccept(withPreview(EMAIL_PREVIEW));
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Seu nome'), 'Ana');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.type(screen.getByLabelText('Confirme a senha'), 'outra-senha');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não conferem.');
    expect(repository.accept).not.toHaveBeenCalled();
  });

  test('an invalid invitation shows the 404 copy and offers the login', async () => {
    const { onSignIn } = renderAccept(
      fakeInvitationRepository({
        preview: jest.fn().mockRejectedValue(new InvitationError('invalid-invitation')),
      }),
    );
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Convite inválido ou expirado. Peça um novo convite ao administrador.',
    );
    await user.click(screen.getByRole('button', { name: 'Ir para o login' }));

    expect(onSignIn).toHaveBeenCalled();
  });

  test('an invitation that expires while filling the form shows the 404 copy', async () => {
    renderAccept(
      withPreview(
        { ...EMAIL_PREVIEW, accountExists: true },
        { accept: jest.fn().mockRejectedValue(new InvitationError('invalid-invitation')) },
      ),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Senha'), 'minha-senha');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Convite inválido ou expirado. Peça um novo convite ao administrador.',
    );
  });

  test.each([
    ['invalid-input', 'Confira os dados informados.'],
    ['rate-limited', 'Muitas tentativas, tente mais tarde.'],
    ['unavailable', 'Não foi possível concluir. Verifique a conexão com o servidor.'],
  ] as const)('a %s failure on accept is explained', async (kind, message) => {
    renderAccept(
      withPreview(
        { ...EMAIL_PREVIEW, accountExists: true },
        { accept: jest.fn().mockRejectedValue(new InvitationError(kind)) },
      ),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Senha'), 'minha-senha');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  test('a failed preview for another reason offers a retry', async () => {
    const repository = fakeInvitationRepository({
      preview: jest.fn().mockRejectedValueOnce(new InvitationError('unavailable')),
    });
    repository.preview.mockResolvedValue(OPEN_PREVIEW);
    renderAccept(repository);
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o convite. Verifique a conexão com o servidor.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByLabelText('Seu nome')).toBeInTheDocument();
  });

  test('shows a loading state while the invitation loads', () => {
    renderAccept(
      fakeInvitationRepository({ preview: jest.fn().mockReturnValue(new Promise(() => {})) }),
    );

    expect(screen.getByText('Carregando convite…')).toBeInTheDocument();
  });
});
