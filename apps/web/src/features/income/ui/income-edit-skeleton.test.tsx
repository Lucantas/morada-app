import { render, screen } from '@testing-library/react';

import { IncomeEditSkeleton } from './income-edit-skeleton';

describe('IncomeEditSkeleton', () => {
  test('renders an accessible busy status with field skeletons', () => {
    render(<IncomeEditSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(4);
  });
});
