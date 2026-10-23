import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeUserAccountRepository } from '@/test/factories.account';
import { renderWithClient } from '@/test/render';

import { AccountError } from '../domain/errors';

import { PendingConfirmationScreen } from './pending-confirmation-screen';

describe('PendingConfirmationScreen', () => {
  test('asks the user to confirm the e-mail', () => {
    renderWithClient(
      <PendingConfirmationScreen repository={fakeUserAccountRepository()} onSignOut={jest.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
  });

  test('resends the confirmation link', async () => {
    const repository = fakeUserAccountRepository();
    const user = userEvent.setup();
    renderWithClient(<PendingConfirmationScreen repository={repository} onSignOut={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Reenviar link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Enviamos um novo link para o seu e-mail.',
    );
    expect(repository.resendConfirmation).toHaveBeenCalled();
  });

  test('explains when e-mail sending is unavailable', async () => {
    const repository = fakeUserAccountRepository({
      resendConfirmation: jest.fn().mockRejectedValue(new AccountError('email-unavailable')),
    });
    const user = userEvent.setup();
    renderWithClient(<PendingConfirmationScreen repository={repository} onSignOut={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Reenviar link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Envio de e-mail indisponível. Tente mais tarde.',
    );
  });

  test('signs out', async () => {
    const onSignOut = jest.fn();
    const user = userEvent.setup();
    renderWithClient(
      <PendingConfirmationScreen repository={fakeUserAccountRepository()} onSignOut={onSignOut} />,
    );

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onSignOut).toHaveBeenCalled();
  });
});
