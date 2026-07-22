import { render, screen } from '@testing-library/react';

import { ResidentsSkeleton } from './residents-skeleton';

describe('ResidentsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
