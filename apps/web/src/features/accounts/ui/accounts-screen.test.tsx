import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildAccount } from '@/test/factories.accounts';

import { InMemoryIncomeRepository } from '../../income/data/in-memory-income-repository';

import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountsScreen } from './accounts-screen';

function setup({ incomes = [] as readonly unknown[] } = {}) {
  const repository = new InMemoryAccountRepository([
    buildAccount({ id: 'a-1', description: 'Água — abril', valueCents: 124000, status: 'pago' }),
    buildAccount({ id: 'a-2', description: 'Jardinagem', valueCents: 45000, status: 'pendente' }),
  ]);
  const incomeRepository = new InMemoryIncomeRepository(incomes);
  const onOpenAccount = jest.fn();
  const onOpenIncome = jest.fn();
  renderWithClient(
    <AccountsScreen
      repository={repository}
      onOpenAccount={onOpenAccount}
      incomeRepository={incomeRepository}
      onOpenIncome={onOpenIncome}
      bottomNav={null}
    />,
  );
  return { onOpenAccount, onOpenIncome };
}

describe('AccountsScreen', () => {
  test('renders the account rows once loaded', async () => {
    setup();

    expect(await screen.findByText('Água — abril')).toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
  });

  test('shows the paid and due header totals', async () => {
    setup();

    await screen.findByText('Água — abril');
    expect(screen.getByText('Pago no mês')).toBeInTheDocument();
    expect(screen.getByText('A pagar')).toBeInTheDocument();
    expect(screen.getByText('1.240,00')).toBeInTheDocument();
    expect(screen.getByText('450,00')).toBeInTheDocument();
  });

  test('registering a new account calls back with no id', async () => {
    const { onOpenAccount } = setup();
    await screen.findByText('Água — abril');

    await userEvent.click(screen.getByRole('button', { name: /registrar nova conta/i }));

    expect(onOpenAccount).toHaveBeenCalledWith();
  });

  test('clicking an account opens it by id', async () => {
    const { onOpenAccount } = setup();

    await userEvent.click(await screen.findByText('Água — abril'));

    await waitFor(() => expect(onOpenAccount).toHaveBeenCalledWith('a-1'));
  });

  test('renders the "Outras entradas" section and opens an income by id', async () => {
    const { onOpenIncome } = setup({
      incomes: [
        {
          id: 'i-1',
          description: 'Aluguel salão de festas',
          source: 'Salão de festas',
          date: '2026-04-10',
          valueCents: 20000,
        },
      ],
    });
    await screen.findByText('Água — abril');

    expect(await screen.findByText('Aluguel salão de festas')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Aluguel salão de festas'));

    await waitFor(() => expect(onOpenIncome).toHaveBeenCalledWith('i-1'));
  });

  test('clicking "Adicionar" in "Outras entradas" opens a new income', async () => {
    const { onOpenIncome } = setup();
    await screen.findByText('Água — abril');

    await userEvent.click(screen.getByRole('button', { name: /adicionar/i }));

    expect(onOpenIncome).toHaveBeenCalledWith();
  });

  test('shows an empty state when there are no incomes', async () => {
    setup();
    await screen.findByText('Água — abril');

    expect(await screen.findByText('Nenhuma entrada registrada')).toBeInTheDocument();
  });
});
