import { render, screen } from '@testing-library/react';

import { SettingsSkeleton } from './settings-skeleton';

describe('SettingsSkeleton', () => {
  test('renders an accessible busy status with skeleton blocks', () => {
    render(<SettingsSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
