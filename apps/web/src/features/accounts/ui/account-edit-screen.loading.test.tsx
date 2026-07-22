import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { AccountEditScreen } from './account-edit-screen';

jest.mock('../domain/get-account', () => ({
  getAccount: () => new Promise(() => {}),
}));

describe('AccountEditScreen loading', () => {
  test('renders the field skeleton while an existing account loads', () => {
    renderWithClient(
      <AccountEditScreen repository={{} as never} accountId="a-1" onBack={() => {}} />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
