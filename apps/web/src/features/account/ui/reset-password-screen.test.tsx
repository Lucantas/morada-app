import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ADMIN_LOGIN, fakeUserAccountRepository } from '@/test/factories.account';
import { renderWithClient } from '@/test/render';

import { AccountError } from '../domain/errors';

import { ResetPasswordScreen } from './reset-password-screen';

function renderReset(repository = fakeUserAccountRepository()) {
  const props = { token: 'tok-9', repository, onLoggedIn: jest.fn(), onRequestNewLink: jest.fn() };
  renderWithClient(<ResetPasswordScreen {...props} />);
  return props;
}

async function submit(password: string, confirmation: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nova senha'), password);
  await user.type(screen.getByLabelText('Confirme a nova senha'), confirmation);
  await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
  return user;
}

describe('ResetPasswordScreen', () => {
  test('rejects a password shorter than 8 characters', async () => {
    const { repository } = renderReset();

    await submit('1234567', '1234567');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A senha precisa ter pelo menos 8 caracteres.',
    );
    expect(repository.resetPassword).not.toHaveBeenCalled();
  });

  test('rejects a confirmation that does not match', async () => {
    const { repository } = renderReset();

    await submit('novasenha1', 'novasenha2');

    expect(screen.getByRole('alert')).toHaveTextContent('As senhas não conferem.');
    expect(repository.resetPassword).not.toHaveBeenCalled();
  });

  test('saves the new password and lands in the app', async () => {
    const { repository, onLoggedIn } = renderReset();

    await submit('novasenha1', 'novasenha1');

    expect(repository.resetPassword).toHaveBeenCalledWith('tok-9', 'novasenha1');
    expect(onLoggedIn).toHaveBeenCalledWith(ADMIN_LOGIN);
  });

  test('explains an invalid link and offers a new one', async () => {
    const { onRequestNewLink } = renderReset(
      fakeUserAccountRepository({
        resetPassword: jest.fn().mockRejectedValue(new AccountError('invalid-link')),
      }),
    );

    const user = await submit('novasenha1', 'novasenha1');

    expect(await screen.findByText('Link inválido ou expirado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pedir um novo link' }));
    expect(onRequestNewLink).toHaveBeenCalled();
  });
});
