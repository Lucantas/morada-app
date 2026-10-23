import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ADMIN_LOGIN, fakeAuthRepository } from '@/test/factories.auth';
import { renderWithClient } from '@/test/render';

import { AuthError } from '../domain/errors';

import { ConfirmEmailScreen } from './confirm-email-screen';

function renderConfirm(repository = fakeAuthRepository()) {
  const props = {
    token: 'tok-123',
    repository,
    onLoggedIn: jest.fn(),
    onSignIn: jest.fn(),
    onForgotPassword: jest.fn(),
  };
  renderWithClient(<ConfirmEmailScreen {...props} />);
  return props;
}

async function submitPassword(password = 'segredo123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Confirmar e-mail' }));
  return user;
}

describe('ConfirmEmailScreen', () => {
  test('posts the token with the password and lands in the app', async () => {
    const { repository, onLoggedIn } = renderConfirm();

    await submitPassword();

    expect(repository.confirmEmail).toHaveBeenCalledWith('tok-123', 'segredo123');
    expect(onLoggedIn).toHaveBeenCalledWith(ADMIN_LOGIN);
  });

  test('keeps the form on a wrong password', async () => {
    const { onLoggedIn } = renderConfirm(
      fakeAuthRepository({
        confirmEmail: jest.fn().mockRejectedValue(new AuthError('invalid-credentials')),
      }),
    );

    await submitPassword();

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.');
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(onLoggedIn).not.toHaveBeenCalled();
  });

  test('explains an invalid link and offers a new one', async () => {
    const { onSignIn, onForgotPassword } = renderConfirm(
      fakeAuthRepository({
        confirmEmail: jest.fn().mockRejectedValue(new AuthError('invalid-link')),
      }),
    );

    const user = await submitPassword();

    expect(await screen.findByText('Link inválido ou expirado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entrar para receber um novo link' }));
    expect(onSignIn).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Esqueci a senha' }));
    expect(onForgotPassword).toHaveBeenCalled();
  });

  test('always offers the forgot-password hint', async () => {
    const { onForgotPassword } = renderConfirm();
    const user = userEvent.setup();

    expect(screen.getByText(/Não consegue confirmar\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Esqueci a senha' }));

    expect(onForgotPassword).toHaveBeenCalled();
  });

  test('does not submit without a password', async () => {
    const { repository } = renderConfirm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirmar e-mail' }));

    expect(repository.confirmEmail).not.toHaveBeenCalled();
  });

  test('asks to review the data on a rejected confirmation', async () => {
    renderConfirm(
      fakeAuthRepository({
        confirmEmail: jest.fn().mockRejectedValue(new AuthError('invalid-input')),
      }),
    );

    await submitPassword();

    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os dados informados.');
  });

  test('shows a connection error for other failures', async () => {
    renderConfirm(
      fakeAuthRepository({
        confirmEmail: jest.fn().mockRejectedValue(new AuthError('unavailable')),
      }),
    );

    await submitPassword();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir. Verifique a conexão com o servidor.',
    );
  });
});
