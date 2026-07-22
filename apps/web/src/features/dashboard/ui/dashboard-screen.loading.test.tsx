import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { DashboardScreen } from './dashboard-screen';

jest.mock('./use-dashboard', () => ({
  ...jest.requireActual('./use-dashboard'),
  useDashboard: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('DashboardScreen loading', () => {
  test('renders the skeleton while the panel loads', () => {
    renderWithClient(
      <DashboardScreen
        repository={{} as never}
        onSendNotice={() => {}}
        onSeeAccounts={() => {}}
        bottomNav={null}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
