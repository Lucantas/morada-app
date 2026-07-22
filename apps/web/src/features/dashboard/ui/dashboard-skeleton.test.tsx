import { render, screen } from '@testing-library/react';

import { DashboardSkeleton } from './dashboard-skeleton';

describe('DashboardSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<DashboardSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
