import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { AccountsScreen } from './accounts-screen';

jest.mock('./use-accounts', () => ({
  ...jest.requireActual('./use-accounts'),
  useAccounts: () => ({ isLoading: true, isError: false, isSuccess: false, data: undefined }),
}));

describe('AccountsScreen loading', () => {
  test('renders the skeleton while accounts load', () => {
    renderWithClient(
      <AccountsScreen
        repository={{} as never}
        onOpenAccount={() => {}}
        incomeSection={null}
        bottomNav={null}
        monthlyIncomeCents={{}}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
