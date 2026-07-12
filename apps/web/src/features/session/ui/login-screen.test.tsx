import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginScreen } from './login-screen';

describe('LoginScreen', () => {
  test('submits the typed username and password', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<LoginScreen onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Usuário'), 'maria302');
    await user.type(screen.getByLabelText('Senha'), 'morada-demo');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).toHaveBeenCalledWith('maria302', 'morada-demo');
  });

  test('does not submit when the fields are empty', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<LoginScreen onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('shows an error message when provided', () => {
    render(<LoginScreen onSubmit={jest.fn()} error="Usuário ou senha inválidos" />);
    expect(screen.getByText('Usuário ou senha inválidos')).toBeInTheDocument();
  });
});
