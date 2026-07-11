import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginScreen } from './login-screen';

describe('LoginScreen', () => {
  test('entering as administrador reports the admin role', async () => {
    const onEnter = jest.fn();
    render(<LoginScreen onEnter={onEnter} />);

    await userEvent.click(screen.getByRole('button', { name: 'Administrador' }));

    expect(onEnter).toHaveBeenCalledWith('admin');
  });

  test('entering as morador reports the resident role', async () => {
    const onEnter = jest.fn();
    render(<LoginScreen onEnter={onEnter} />);

    await userEvent.click(screen.getByRole('button', { name: 'Morador' }));

    expect(onEnter).toHaveBeenCalledWith('resident');
  });
});
