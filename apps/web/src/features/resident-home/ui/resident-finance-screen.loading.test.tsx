import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { ResidentFinanceScreen } from './resident-finance-screen';

jest.mock('./use-resident-finance', () => ({
  ...jest.requireActual('./use-resident-finance'),
  useResidentFinance: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('ResidentFinanceScreen loading', () => {
  test('renders the skeleton while the condo summary loads', () => {
    renderWithClient(<ResidentFinanceScreen dashboardRepository={{} as never} bottomNav={null} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
