import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { ResidentHomeScreen } from './resident-home-screen';

jest.mock('./use-resident-home', () => ({
  ...jest.requireActual('./use-resident-home'),
  useResidentHome: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('ResidentHomeScreen loading', () => {
  test('renders the skeleton while the home loads', () => {
    renderWithClient(
      <ResidentHomeScreen
        receiptRepository={{} as never}
        resident={{ name: 'Maria', apt: 'Apto 302' }}
        onGoReceipts={() => {}}
        onGoFinance={() => {}}
        onGoNotices={() => {}}
        bottomNav={null}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
