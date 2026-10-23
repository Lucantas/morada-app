import { act, render, screen } from '@testing-library/react';

import { useSessionStore } from '@/features/session/ui/session-store';
import { useCondoScope } from '@/shared/lib/condo-scope';

import { App } from './app';

jest.mock('./container', () => {
  const { InMemoryReceiptRepository } = jest.requireActual(
    '@/features/receipts/data/in-memory-receipt-repository',
  );
  const { buildResident: build } = jest.requireActual('@/test/factories');
  const unused = {};
  return {
    residentRepository: {
      getCurrent: async () => build({ id: 'r-1', name: 'Maria Ribeiro' }),
    },
    receiptRepository: new InMemoryReceiptRepository([]),
    accountRepository: unused,
    categoryRepository: unused,
    condoInfoRepository: unused,
    dashboardRepository: unused,
    incomeRepository: unused,
    noticeRepository: unused,
    settingsRepository: unused,
    confirmPayment: jest.fn(),
    editReceipt: jest.fn(),
    ensureMonthlyReceipts: jest.fn(),
    getResidentLogin: jest.fn(),
    issueCharge: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    overrideResidentStatus: jest.fn(),
    provisionResidentLogin: jest.fn(),
    registerPayment: jest.fn(),
    rejectPayment: jest.fn(),
    resetResidentLogin: jest.fn(),
  };
});

describe('App router', () => {
  afterEach(() => {
    act(() => useSessionStore.getState().signOut());
  });

  test('renders the resident home for a resident session with a condominium', async () => {
    act(() => {
      useCondoScope.getState().setCondo({ id: 'c1', name: 'Residencial Ipê' });
      useSessionStore.getState().authenticate('resident', 'r-1');
    });

    render(<App />);

    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
  });

  test('shows the login screen when signed out', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});
