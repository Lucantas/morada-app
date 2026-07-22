import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { ResidentsScreen } from './residents-screen';

jest.mock('./use-residents', () => ({
  ...jest.requireActual('./use-residents'),
  useResidents: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('ResidentsScreen loading', () => {
  test('renders the skeleton while apartments load', () => {
    renderWithClient(
      <ResidentsScreen repository={{} as never} onOpenResident={() => {}} bottomNav={null} />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
