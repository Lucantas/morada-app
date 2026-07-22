import { render, screen } from '@testing-library/react';

import { AccountsSkeleton } from './accounts-skeleton';

describe('AccountsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<AccountsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
