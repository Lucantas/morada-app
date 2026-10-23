import { render, screen } from '@testing-library/react';

import { ResidentAccessSkeleton } from './resident-access-skeleton';

describe('ResidentAccessSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentAccessSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
