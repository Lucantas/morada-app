import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginScreen } from './login-screen';

function renderLogin(overrides: Partial<Parameters<typeof LoginScreen>[0]> = {}) {
  const props = {
    onSubmit: jest.fn(),
    onSignUp: jest.fn(),
    onForgotPassword: jest.fn(),
    ...overrides,
  };
  render(<LoginScreen {...props} />);
  return props;
}

describe('LoginScreen', () => {
  test('shows only the product name, with no condominium', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Morada' })).toBeInTheDocument();
    expect(screen.queryByText(/bloco/i)).not.toBeInTheDocument();
  });

  test('submits the typed login and password', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderLogin();

    await user.type(screen.getByLabelText('E-mail ou usuário'), ' ana@exemplo.com ');
    await user.type(screen.getByLabelText('Senha'), 'morada-demo');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).toHaveBeenCalledWith('ana@exemplo.com', 'morada-demo');
  });

  test('keeps the login field reachable by the legacy usuário label', () => {
    renderLogin();

    expect(screen.getByLabelText(/usuário/i)).toBeInTheDocument();
  });

  test('does not submit when the fields are empty', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderLogin();

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('shows an error message when provided', () => {
    renderLogin({ error: 'Usuário ou senha inválidos.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.');
  });

  test('opens the sign-up flow', async () => {
    const user = userEvent.setup();
    const { onSignUp } = renderLogin();

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(onSignUp).toHaveBeenCalled();
  });

  test('opens the forgot-password flow', async () => {
    const user = userEvent.setup();
    const { onForgotPassword } = renderLogin();

    await user.click(screen.getByRole('button', { name: 'Esqueci a senha' }));

    expect(onForgotPassword).toHaveBeenCalled();
  });
});
