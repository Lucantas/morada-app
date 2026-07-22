import { render, screen } from '@testing-library/react';

import { ResidentHomeSkeleton } from './resident-home-skeleton';

describe('ResidentHomeSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentHomeSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
