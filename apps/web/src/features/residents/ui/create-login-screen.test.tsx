import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreateLoginScreen } from './create-login-screen';

describe('CreateLoginScreen', () => {
  test('provisions a login and reveals the generated temp password', async () => {
    const user = userEvent.setup();
    const provision = jest
      .fn()
      .mockResolvedValue({ username: 'maria302', tempPassword: '7Kq2Ab9m' });

    render(
      <CreateLoginScreen
        residentId="r-1"
        residentName="Maria Ribeiro"
        provision={provision}
        onBack={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Usuário'), 'maria302');
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

    expect(provision).toHaveBeenCalledWith({ username: 'maria302', residentId: 'r-1' });
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
        onBack={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Usuário'), 'maria302');
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

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
        onBack={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Usuário'), 'maria302');
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));
    await screen.findByText('7Kq2Ab9m');

    await user.click(screen.getByRole('button', { name: 'Copiar Senha temporária' }));

    expect(writeText).toHaveBeenCalledWith('7Kq2Ab9m');
    expect(await screen.findByText('Copiado!')).toBeInTheDocument();
  });
});
