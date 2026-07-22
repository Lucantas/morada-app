import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { SettingsScreen } from './settings-screen';

jest.mock('./use-settings', () => ({
  ...jest.requireActual('./use-settings'),
  useSettings: () => ({ isLoading: true, isError: false, isSuccess: false }),
}));

describe('SettingsScreen loading', () => {
  test('renders the skeleton while settings load', () => {
    renderWithClient(
      <SettingsScreen
        repository={{} as never}
        categories={[]}
        categoriesError={false}
        categoriesReady
        savingCategories={false}
        onSaveCategories={async () => ({ reclassified: 0 })}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
