import { render, screen } from '@testing-library/react';

import { NoticesSkeleton } from './notices-skeleton';

describe('NoticesSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<NoticesSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
