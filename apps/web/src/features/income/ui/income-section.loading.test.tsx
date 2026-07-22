import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { IncomeSection } from './income-section';

jest.mock('./use-income', () => ({
  ...jest.requireActual('./use-income'),
  useIncomes: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('IncomeSection loading', () => {
  test('renders the skeleton while income loads', () => {
    renderWithClient(<IncomeSection repository={{} as never} onOpenIncome={() => {}} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
