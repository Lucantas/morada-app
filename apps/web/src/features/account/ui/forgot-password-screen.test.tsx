import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeUserAccountRepository } from '@/test/factories.account';
import { renderWithClient } from '@/test/render';

import { AccountError } from '../domain/errors';

import { ForgotPasswordScreen } from './forgot-password-screen';

async function submit(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.click(screen.getByRole('button', { name: 'Enviar link' }));
  return user;
}

describe('ForgotPasswordScreen', () => {
  test('always confirms without revealing whether the account exists', async () => {
    const repository = fakeUserAccountRepository();
    renderWithClient(<ForgotPasswordScreen repository={repository} onBack={jest.fn()} />);

    await submit(' Ana@Exemplo.com');

    expect(
      await screen.findByText(
        'Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.',
      ),
    ).toBeInTheDocument();
    expect(repository.requestPasswordReset).toHaveBeenCalledWith('ana@exemplo.com');
  });

  test('rejects an invalid e-mail', async () => {
    const repository = fakeUserAccountRepository();
    renderWithClient(<ForgotPasswordScreen repository={repository} onBack={jest.fn()} />);

    await submit('ana');

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    expect(repository.requestPasswordReset).not.toHaveBeenCalled();
  });

  test('explains too many attempts', async () => {
    const repository = fakeUserAccountRepository({
      requestPasswordReset: jest.fn().mockRejectedValue(new AccountError('rate-limited')),
    });
    renderWithClient(<ForgotPasswordScreen repository={repository} onBack={jest.fn()} />);

    await submit('ana@exemplo.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas, tente mais tarde.',
    );
  });

  test('goes back to the login', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    renderWithClient(
      <ForgotPasswordScreen repository={fakeUserAccountRepository()} onBack={onBack} />,
    );

    await user.click(screen.getByRole('button', { name: 'Voltar para o login' }));

    expect(onBack).toHaveBeenCalled();
  });
});
