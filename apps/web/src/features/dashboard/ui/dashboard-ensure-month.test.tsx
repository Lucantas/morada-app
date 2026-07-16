import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import { DashboardScreen } from './dashboard-screen';

jest.mock('./use-dashboard', () => ({
  useDashboard: () => ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: {
      balance: { balanceCents: 0, incomeCents: 0, paidCents: 0 },
      recentPaid: [],
      maintenances: [],
    },
  }),
}));

const ensureMock = jest.fn().mockResolvedValue(undefined);

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardScreen
        repository={{} as never}
        onSendNotice={() => {}}
        onOpenMessages={() => {}}
        onSeeAccounts={() => {}}
        unreadCount={0}
        bottomNav={null}
        ensureMonthlyReceipts={() => ensureMock()}
      />
    </QueryClientProvider>,
  );
}

describe('DashboardScreen monthly ensure', () => {
  it('calls ensure-month once on mount', async () => {
    ensureMock.mockClear();
    ensureMock.mockResolvedValueOnce(undefined);
    renderScreen();
    await waitFor(() => expect(ensureMock).toHaveBeenCalledTimes(1));
  });

  it('shows a non-blocking notice when ensure-month fails', async () => {
    ensureMock.mockClear();
    ensureMock.mockRejectedValueOnce(new Error('network error'));
    renderScreen();
    expect(
      await screen.findByText(/Não foi possível gerar as cobranças do mês/),
    ).toBeInTheDocument();
  });
});
