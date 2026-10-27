import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { clearTestCondo, setTestCondo, TEST_CONDO_NAME } from '@/test/condo';
import { renderWithClient } from '@/test/render';
import { buildDashboardSummary } from '@/test/factories.dashboard';

import { InMemoryCategoryRepository } from '@/features/categories/data/in-memory-category-repository';

import { InMemoryDashboardRepository } from '../data/in-memory-dashboard-repository';

import { DashboardScreen } from './dashboard-screen';

beforeEach(() => setTestCondo());
afterEach(() => clearTestCondo());

function setup() {
  const onSelectWindow = jest.fn();
  const categories = new InMemoryCategoryRepository([
    { id: 'c-1', name: 'Água', keywords: '', position: 0 },
    { id: 'c-2', name: 'Energia', keywords: '', position: 1 },
  ]);
  const repository = new InMemoryDashboardRepository(buildDashboardSummary());
  const onSendNotice = jest.fn();
  const onSeeAccounts = jest.fn();
  const onOpenSettings = jest.fn();
  renderWithClient(
    <DashboardScreen
      repository={repository}
      onSendNotice={onSendNotice}
      onSeeAccounts={onSeeAccounts}
      onOpenSettings={onOpenSettings}
      bottomNav={null}
      categories={categories}
      renderBuilding={(ground) => (
        <section>
          <button type="button" onClick={() => onSelectWindow('Apto 101')}>
            Apto 101
          </button>
          {ground}
        </section>
      )}
    />,
  );
  return { onSendNotice, onSeeAccounts, onOpenSettings, onSelectWindow };
}

describe('DashboardScreen', () => {
  test('shows the condominium name', async () => {
    setup();

    expect(await screen.findByText(TEST_CONDO_NAME)).toBeInTheDocument();
  });

  test('renders the condo balance value', async () => {
    setup();

    expect(await screen.findByText('12.480,00')).toBeInTheDocument();
  });

  test('home shows the building and the térreo', async () => {
    setup();

    expect(await screen.findByRole('button', { name: 'Apto 101' })).toBeInTheDocument();
    expect(await screen.findByText('Em caixa')).toBeInTheDocument();
    expect(await screen.findByText('R$ 12.480,00')).toBeInTheDocument();
    expect(await screen.findByText('R$ 4.120,00')).toBeInTheDocument();
    expect(await screen.findByText('Água · Energia')).toBeInTheDocument();
  });

  test('tapping a window goes through the building slot', async () => {
    const { onSelectWindow } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Apto 101' }));

    expect(onSelectWindow).toHaveBeenCalledWith('Apto 101');
  });

  test('firing "Enviar aviso" calls onSendNotice', async () => {
    const { onSendNotice } = setup();

    await userEvent.click(await screen.findByText('Enviar aviso'));

    expect(onSendNotice).toHaveBeenCalledTimes(1);
  });

  test('does not expose the messages entry point', async () => {
    setup();

    await screen.findByText('Enviar aviso');

    expect(screen.queryByText('Mensagens')).not.toBeInTheDocument();
  });

  test('firing "Ver todas" calls onSeeAccounts', async () => {
    const { onSeeAccounts } = setup();

    await userEvent.click(await screen.findByRole('button', { name: /ver todas/i }));

    expect(onSeeAccounts).toHaveBeenCalledTimes(1);
  });

  test('renders a recent paid item and a maintenance item', async () => {
    setup();

    expect(await screen.findByText('Conta de água — abril')).toBeInTheDocument();
    expect(screen.getByText("Bomba d'água")).toBeInTheDocument();
  });

  test('the header gear navigates to settings', async () => {
    const user = userEvent.setup();
    const { onOpenSettings } = setup();

    await user.click(await screen.findByRole('button', { name: /ajustes/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
