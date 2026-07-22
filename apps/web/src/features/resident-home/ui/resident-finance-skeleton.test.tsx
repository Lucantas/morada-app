import { render, screen } from '@testing-library/react';

import { ResidentFinanceSkeleton } from './resident-finance-skeleton';

describe('ResidentFinanceSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentFinanceSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
