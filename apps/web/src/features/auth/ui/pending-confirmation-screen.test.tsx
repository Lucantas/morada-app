import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeAuthRepository } from '@/test/factories.auth';
import { renderWithClient } from '@/test/render';

import { AuthError } from '../domain/errors';

import { PendingConfirmationScreen } from './pending-confirmation-screen';

describe('PendingConfirmationScreen', () => {
  test('asks the user to confirm the e-mail', () => {
    renderWithClient(
      <PendingConfirmationScreen repository={fakeAuthRepository()} onSignOut={jest.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
  });

  test('names the condominium an invite unlocks', () => {
    renderWithClient(
      <PendingConfirmationScreen
        repository={fakeAuthRepository()}
        onSignOut={jest.fn()}
        condoName="Edifício Sol"
      />,
    );

    expect(
      screen.getByText(
        'Enviamos um link para confirmar seu e-mail. Depois de confirmar, o acesso ao Edifício Sol é liberado.',
      ),
    ).toBeInTheDocument();
  });

  test('resends the confirmation link', async () => {
    const repository = fakeAuthRepository();
    const user = userEvent.setup();
    renderWithClient(<PendingConfirmationScreen repository={repository} onSignOut={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Reenviar link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Enviamos um novo link para o seu e-mail.',
    );
    expect(repository.resendConfirmation).toHaveBeenCalled();
  });

  test('explains when e-mail sending is unavailable', async () => {
    const repository = fakeAuthRepository({
      resendConfirmation: jest.fn().mockRejectedValue(new AuthError('email-unavailable')),
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
      <PendingConfirmationScreen repository={fakeAuthRepository()} onSignOut={onSignOut} />,
    );

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onSignOut).toHaveBeenCalled();
  });
});
