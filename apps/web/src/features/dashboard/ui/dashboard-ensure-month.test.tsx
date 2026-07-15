import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';

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
jest.mock('@/app/container', () => ({ ensureMonthlyReceipts: () => ensureMock() }));

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
      />
    </QueryClientProvider>,
  );
}

describe('DashboardScreen monthly ensure', () => {
  it('calls ensure-month once on mount', async () => {
    ensureMock.mockClear();
    renderScreen();
    await waitFor(() => expect(ensureMock).toHaveBeenCalledTimes(1));
  });
});
