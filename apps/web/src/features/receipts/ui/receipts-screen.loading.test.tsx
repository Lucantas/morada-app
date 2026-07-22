import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { ReceiptsScreen } from './receipts-screen';

jest.mock('./use-receipts', () => ({
  ...jest.requireActual('./use-receipts'),
  useReceipts: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('ReceiptsScreen loading', () => {
  test('renders the skeleton while receipts load', () => {
    renderWithClient(
      <ReceiptsScreen
        repository={{} as never}
        resident={{ name: 'Maria', apt: 'Apto 302' }}
        onPay={() => {}}
        bottomNav={null}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
