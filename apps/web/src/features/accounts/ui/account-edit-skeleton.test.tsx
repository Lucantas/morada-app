import { render, screen } from '@testing-library/react';

import { AccountEditSkeleton } from './account-edit-skeleton';

describe('AccountEditSkeleton', () => {
  test('renders an accessible busy status with field skeletons', () => {
    render(<AccountEditSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(4);
  });
});
