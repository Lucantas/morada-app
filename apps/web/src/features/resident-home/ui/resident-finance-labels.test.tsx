import { render, screen } from '@testing-library/react';

import { ResidentFinanceScreen } from './resident-finance-screen';

jest.mock('./use-resident-finance', () => ({
  useResidentFinance: () => ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: {
      balance: { balanceCents: 500000, incomeCents: 30000, paidCents: 8000 },
      recentPaid: [],
      maintenances: [],
    },
  }),
}));

describe('ResidentFinanceScreen labels', () => {
  it('scopes entradas and contas pagas to the month', () => {
    render(<ResidentFinanceScreen dashboardRepository={{} as never} bottomNav={null} />);
    expect(screen.getByText('Entradas do mês')).toBeInTheDocument();
    expect(screen.getByText('Contas pagas do mês')).toBeInTheDocument();
  });
});
