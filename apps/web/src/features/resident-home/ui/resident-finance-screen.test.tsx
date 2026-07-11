import { screen } from '@testing-library/react';

import { InMemoryDashboardRepository } from '@/features/dashboard/data/in-memory-dashboard-repository';
import { buildDashboardSummary } from '@/test/factories.dashboard';
import { renderWithClient } from '@/test/render';

import { ResidentFinanceScreen } from './resident-finance-screen';

function setup() {
  const dashboardRepository = new InMemoryDashboardRepository(buildDashboardSummary());
  renderWithClient(
    <ResidentFinanceScreen dashboardRepository={dashboardRepository} bottomNav={null} />,
  );
}

describe('ResidentFinanceScreen', () => {
  test('renders the condo balance value', async () => {
    setup();

    expect(await screen.findByText('12.480,00')).toBeInTheDocument();
  });

  test('renders a recent paid item', async () => {
    setup();

    expect(await screen.findByText('Conta de água — abril')).toBeInTheDocument();
  });
});
