import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildAccount } from '@/test/factories.accounts';

import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountsScreen } from './accounts-screen';

function setup() {
  const repository = new InMemoryAccountRepository([
    buildAccount({ id: 'a-1', description: 'Água — abril', valueCents: 124000, status: 'pago' }),
    buildAccount({ id: 'a-2', description: 'Jardinagem', valueCents: 45000, status: 'pendente' }),
  ]);
  const onOpenAccount = jest.fn();
  renderWithClient(
    <AccountsScreen
      repository={repository}
      onOpenAccount={onOpenAccount}
      incomeSection={<div>outras-entradas-slot</div>}
      bottomNav={null}
    />,
  );
  return { onOpenAccount };
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

  test('renders the injected income section slot', async () => {
    setup();
    await screen.findByText('Água — abril');

    expect(screen.getByText('outras-entradas-slot')).toBeInTheDocument();
  });
});
