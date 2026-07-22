import { render, screen } from '@testing-library/react';

import { ResidentEditSkeleton } from './resident-edit-skeleton';

describe('ResidentEditSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ResidentEditSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(4);
  });
});
