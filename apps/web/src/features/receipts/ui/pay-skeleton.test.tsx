import { render, screen } from '@testing-library/react';

import { PaySkeleton } from './pay-skeleton';

describe('PaySkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<PaySkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
