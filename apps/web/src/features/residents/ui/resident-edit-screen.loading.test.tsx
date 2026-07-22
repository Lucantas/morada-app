import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { ResidentEditScreen } from './resident-edit-screen';

jest.mock('../domain/get-resident', () => ({
  getResident: () => new Promise(() => {}),
}));

describe('ResidentEditScreen loading', () => {
  test('renders the skeleton while an existing resident loads', () => {
    renderWithClient(
      <ResidentEditScreen
        repository={{} as never}
        receiptRepository={{} as never}
        residentId="r-1"
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
