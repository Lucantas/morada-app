import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { clearTestCondo, setTestCondo, TEST_CONDO_NAME } from '@/test/condo';
import { buildCurrentResident } from '@/test/factories.resident-home';
import { renderWithClient } from '@/test/render';

import { ResidentProfileScreen } from './resident-profile-screen';

beforeEach(() => setTestCondo());
afterEach(() => clearTestCondo());

function setup() {
  const resident = buildCurrentResident();
  const onSignOut = jest.fn();
  renderWithClient(
    <ResidentProfileScreen resident={resident} onSignOut={onSignOut} bottomNav={null} />,
  );
  return { resident, onSignOut };
}

describe('ResidentProfileScreen', () => {
  test('renders the resident name, apartment and email', () => {
    const { resident } = setup();

    expect(screen.getByText(resident.name)).toBeInTheDocument();
    expect(screen.getByText(`${resident.apt} · ${TEST_CONDO_NAME}`)).toBeInTheDocument();
    expect(screen.getByText(resident.email)).toBeInTheDocument();
  });

  test('shows the condominium name in the header', () => {
    setup();

    expect(screen.getByText(TEST_CONDO_NAME)).toBeInTheDocument();
  });

  test('clicking "Sair" fires onSignOut', async () => {
    const { onSignOut } = setup();

    await userEvent.click(screen.getByRole('button', { name: /sair/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
