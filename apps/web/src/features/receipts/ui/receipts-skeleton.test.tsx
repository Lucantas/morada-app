import { render, screen } from '@testing-library/react';

import { ReceiptsSkeleton } from './receipts-skeleton';

describe('ReceiptsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<ReceiptsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  });
});
