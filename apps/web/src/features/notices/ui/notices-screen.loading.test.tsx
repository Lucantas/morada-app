import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { NoticesScreen } from './notices-screen';

jest.mock('./use-notices', () => ({
  ...jest.requireActual('./use-notices'),
  useNotices: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('NoticesScreen loading', () => {
  test('renders the skeleton while notices load', () => {
    renderWithClient(<NoticesScreen repository={{} as never} bottomNav={null} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
