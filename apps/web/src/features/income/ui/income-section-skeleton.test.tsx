import { render, screen } from '@testing-library/react';

import { IncomeSectionSkeleton } from './income-section-skeleton';

describe('IncomeSectionSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<IncomeSectionSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
