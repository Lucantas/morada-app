import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildDashboardSummary } from '@/test/factories.dashboard';

import { InMemoryDashboardRepository } from '../data/in-memory-dashboard-repository';

import { DashboardScreen } from './dashboard-screen';

function setup() {
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
    />,
  );
  return { onSendNotice, onSeeAccounts, onOpenSettings };
}

describe('DashboardScreen', () => {
  test('renders the condo balance value', async () => {
    setup();

    expect(await screen.findByText('12.480,00')).toBeInTheDocument();
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
