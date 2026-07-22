import { render, screen } from '@testing-library/react';

import { CreateLoginScreen } from './create-login-screen';

describe('CreateLoginScreen loading', () => {
  test('renders the skeleton while the existing login is checked', () => {
    render(
      <CreateLoginScreen
        residentId="r-1"
        provision={async () => ({ username: '', tempPassword: '' })}
        fetchLogin={() => new Promise(() => {})}
        reset={async () => ({ username: '', tempPassword: '' })}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
