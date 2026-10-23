import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeUserAccountRepository } from '@/test/factories.account';
import { renderWithClient } from '@/test/render';

import { AccountError } from '../domain/errors';

import { SignUpScreen } from './signup-screen';

async function fillAndSubmit(email = 'Ana@Exemplo.com') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nome'), 'Ana Souza');
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), 'segredo123');
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  return user;
}

describe('SignUpScreen', () => {
  test('creates the account and shows where the link was sent', async () => {
    const repository = fakeUserAccountRepository();
    renderWithClient(<SignUpScreen repository={repository} onBack={jest.fn()} />);

    await fillAndSubmit();

    expect(
      await screen.findByText(
        'Enviamos um link para ana@exemplo.com. Abra no celular para confirmar.',
      ),
    ).toBeInTheDocument();
    expect(repository.signUp).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'segredo123',
    });
  });

  test('rejects an invalid e-mail without calling the API', async () => {
    const repository = fakeUserAccountRepository();
    renderWithClient(<SignUpScreen repository={repository} onBack={jest.fn()} />);

    await fillAndSubmit('ana');

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    expect(repository.signUp).not.toHaveBeenCalled();
  });

  test('explains when e-mail sending is unavailable', async () => {
    const repository = fakeUserAccountRepository({
      signUp: jest.fn().mockRejectedValue(new AccountError('email-unavailable')),
    });
    renderWithClient(<SignUpScreen repository={repository} onBack={jest.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Envio de e-mail indisponível. Tente mais tarde.',
    );
  });

  test('goes back to the login', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    renderWithClient(<SignUpScreen repository={fakeUserAccountRepository()} onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: 'Já tenho conta' }));

    expect(onBack).toHaveBeenCalled();
  });
});
