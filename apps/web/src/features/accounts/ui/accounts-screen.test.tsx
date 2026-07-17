import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildAccount } from '@/test/factories.accounts';

import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountsScreen } from './accounts-screen';

function setup(accounts = defaultAccounts) {
  const repository = new InMemoryAccountRepository(accounts);
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

const defaultAccounts = [
  buildAccount({ id: 'a-1', description: 'Água — abril', valueCents: 124000, status: 'pago' }),
  buildAccount({ id: 'a-2', description: 'Jardinagem', valueCents: 45000, status: 'pendente' }),
];

const filterableAccounts = [
  buildAccount({
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
    valueCents: 124000,
    status: 'pago',
  }),
  buildAccount({
    id: 'a-2',
    description: 'Jardinagem',
    category: 'Manutenção',
    date: '2026-05-10',
    valueCents: 45000,
    status: 'pendente',
  }),
  buildAccount({
    id: 'a-3',
    description: 'Energia — abril',
    category: 'Utilidades',
    date: '2026-04-20',
    valueCents: 30000,
    status: 'pago',
  }),
];

describe('AccountsScreen', () => {
  test('renders the account rows once loaded', async () => {
    setup();

    expect(await screen.findByText('Água — abril')).toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
  });

  test('shows the paid (this month) and due header totals', async () => {
    const thisMonth = `${new Date().toISOString().slice(0, 7)}-05`;
    setup([
      buildAccount({
        id: 'a-1',
        description: 'Água — abril',
        date: thisMonth,
        valueCents: 124000,
        status: 'pago',
      }),
      buildAccount({ id: 'a-2', description: 'Jardinagem', valueCents: 45000, status: 'pendente' }),
    ]);

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

  test('typing a name filters to only matching rows', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');

    await userEvent.type(screen.getByLabelText('Buscar por nome'), 'jardin');

    expect(screen.queryByText('Água — abril')).not.toBeInTheDocument();
    expect(screen.queryByText('Energia — abril')).not.toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
  });

  test('picking a category filters to only that category', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');

    await userEvent.selectOptions(screen.getByLabelText(/categoria/i), 'Manutenção');

    expect(screen.queryByText('Água — abril')).not.toBeInTheDocument();
    expect(screen.queryByText('Energia — abril')).not.toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
  });

  test('setting a date range filters to only in-range rows', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '01/04/2026' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '10/04/2026' } });

    expect(screen.getByText('Água — abril')).toBeInTheDocument();
    expect(screen.queryByText('Energia — abril')).not.toBeInTheDocument();
    expect(screen.queryByText('Jardinagem')).not.toBeInTheDocument();
  });
});
