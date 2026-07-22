import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { IncomeEditScreen } from './income-edit-screen';

jest.mock('./use-income', () => ({
  ...jest.requireActual('./use-income'),
  useIncomes: () => ({ isLoading: true, isError: false, isSuccess: false, data: undefined }),
}));

describe('IncomeEditScreen loading', () => {
  test('renders the field skeleton while an existing income loads', () => {
    renderWithClient(
      <IncomeEditScreen incomeId="i-1" repository={{} as never} onBack={() => {}} />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
