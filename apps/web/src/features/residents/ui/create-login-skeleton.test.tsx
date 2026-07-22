import { render, screen } from '@testing-library/react';

import { CreateLoginSkeleton } from './create-login-skeleton';

describe('CreateLoginSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<CreateLoginSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
