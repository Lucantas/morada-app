import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreateLoginScreen } from './create-login-screen';

const suggestsLogin = (suggestedUsername: string) =>
  jest.fn().mockResolvedValue({ existingUsername: null, suggestedUsername });
const noReset = () =>
  jest.fn().mockRejectedValue(new Error('reset should not be called in the create flow'));

describe('CreateLoginScreen', () => {
  describe('when the resident has no login yet', () => {
    test('shows the derived login read-only and provisions it on confirm', async () => {
      const user = userEvent.setup();
      const provision = jest
        .fn()
        .mockResolvedValue({ username: 'maria302', tempPassword: '7Kq2Ab9m' });

      render(
        <CreateLoginScreen
          residentId="r-1"
          residentName="Maria Ribeiro"
          provision={provision}
          fetchLogin={suggestsLogin('maria302')}
          reset={noReset()}
          onBack={jest.fn()}
        />,
      );

      expect(await screen.findByTestId('suggested-username')).toHaveTextContent('maria302');
      expect(screen.queryByLabelText('Usuário')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

      expect(provision).toHaveBeenCalledWith({ residentId: 'r-1' });
      expect(await screen.findByText('7Kq2Ab9m')).toBeInTheDocument();
    });

    test('shows an error when provisioning fails', async () => {
      const user = userEvent.setup();
      const provision = jest.fn().mockRejectedValue(new Error('Usuário já existe: maria302'));

      render(
        <CreateLoginScreen
          residentId="r-1"
          residentName="Maria Ribeiro"
          provision={provision}
          fetchLogin={suggestsLogin('maria302')}
          reset={noReset()}
          onBack={jest.fn()}
        />,
      );

      await user.click(await screen.findByRole('button', { name: 'Criar acesso' }));

      expect(await screen.findByText('Usuário já existe: maria302')).toBeInTheDocument();
    });

    test('copies the generated temp password to the clipboard', async () => {
      const user = userEvent.setup();
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      const provision = jest
        .fn()
        .mockResolvedValue({ username: 'maria302', tempPassword: '7Kq2Ab9m' });

      render(
        <CreateLoginScreen
          residentId="r-1"
          residentName="Maria Ribeiro"
          provision={provision}
          fetchLogin={suggestsLogin('maria302')}
          reset={noReset()}
          onBack={jest.fn()}
        />,
      );

      await user.click(await screen.findByRole('button', { name: 'Criar acesso' }));
      await screen.findByText('7Kq2Ab9m');

      await user.click(screen.getByRole('button', { name: 'Copiar Senha temporária' }));

      expect(writeText).toHaveBeenCalledWith('7Kq2Ab9m');
      expect(await screen.findByText('Copiado!')).toBeInTheDocument();
    });

    test('falls back to the create form when fetching the login fails', async () => {
      const user = userEvent.setup();
      const provision = jest
        .fn()
        .mockResolvedValue({ username: 'maria302', tempPassword: '7Kq2Ab9m' });
      const fetchLogin = jest.fn().mockRejectedValue(new Error('Falha ao consultar o acesso.'));

      render(
        <CreateLoginScreen
          residentId="r-1"
          residentName="Maria Ribeiro"
          provision={provision}
          fetchLogin={fetchLogin}
          reset={noReset()}
          onBack={jest.fn()}
        />,
      );

      expect(await screen.findByText('Falha ao consultar o acesso.')).toBeInTheDocument();
      await user.click(await screen.findByRole('button', { name: 'Criar acesso' }));

      expect(await screen.findByText('7Kq2Ab9m')).toBeInTheDocument();
    });
  });

  describe('when the resident already has a login', () => {
    const hasLogin = () =>
      jest.fn().mockResolvedValue({ existingUsername: 'maria302', suggestedUsername: 'maria302' });

    test('shows the existing username instead of the create form', async () => {
      render(
        <CreateLoginScreen
          residentId="r-1"
          residentName="Maria Ribeiro"
          provision={jest.fn()}
          fetchLogin={hasLogin()}
          reset={jest.fn()}
          onBack={jest.fn()}
        />,
      );

      expect(await screen.findByText('maria302')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Criar acesso' })).not.toBeInTheDocument();
    });

    test('resets the password and reveals a fresh temp password', async () => {
      const user = userEvent.setup();
      const reset = jest.fn().mockResolvedValue({ username: 'maria302', tempPassword: 'NOVA-123' });

      render(
        <CreateLoginScreen
          residentId="r-1"
          residentName="Maria Ribeiro"
          provision={jest.fn()}
          fetchLogin={hasLogin()}
          reset={reset}
          onBack={jest.fn()}
        />,
      );

      await user.click(await screen.findByRole('button', { name: 'Redefinir senha' }));

      expect(reset).toHaveBeenCalledWith('r-1');
      expect(await screen.findByText('NOVA-123')).toBeInTheDocument();
    });

    test('shows an error when resetting fails', async () => {
      const user = userEvent.setup();
      const reset = jest.fn().mockRejectedValue(new Error('Não foi possível redefinir a senha.'));

      render(
        <CreateLoginScreen
          residentId="r-1"
          residentName="Maria Ribeiro"
          provision={jest.fn()}
          fetchLogin={hasLogin()}
          reset={reset}
          onBack={jest.fn()}
        />,
      );

      await user.click(await screen.findByRole('button', { name: 'Redefinir senha' }));

      expect(await screen.findByText('Não foi possível redefinir a senha.')).toBeInTheDocument();
    });
  });
});
