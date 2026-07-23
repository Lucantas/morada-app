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

  test('shows a download link only for a paid item that has a proof', async () => {
    const dashboardRepository = new InMemoryDashboardRepository(
      buildDashboardSummary({
        recentPaid: [
          {
            id: 'p-1',
            label: 'Conta de água — abril',
            dateLabel: 'Paga em 05/04',
            valueCents: 124_000,
            icon: 'water',
            hasProof: true,
          },
          {
            id: 'p-2',
            label: 'Energia — áreas comuns',
            dateLabel: 'Paga em 03/04',
            valueCents: 89_000,
            icon: 'bolt',
          },
        ],
      }),
    );
    renderWithClient(
      <ResidentFinanceScreen dashboardRepository={dashboardRepository} bottomNav={null} />,
    );

    const link = await screen.findByRole('link', { name: /baixar comprovante/i });
    expect(link).toHaveAttribute('href', '/api/accounts/p-1/proof');
    expect(screen.getAllByRole('link', { name: /baixar comprovante/i })).toHaveLength(1);
  });
});
