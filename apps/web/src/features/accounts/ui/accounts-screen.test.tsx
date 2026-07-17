import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildAccount } from '@/test/factories.accounts';

import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountsScreen } from './accounts-screen';

function setup(accounts = defaultAccounts, monthlyIncomeCents: Record<string, number> = {}) {
  const repository = new InMemoryAccountRepository(accounts);
  const onOpenAccount = jest.fn();
  renderWithClient(
    <AccountsScreen
      repository={repository}
      onOpenAccount={onOpenAccount}
      incomeSection={<div>outras-entradas-slot</div>}
      bottomNav={null}
      monthlyIncomeCents={monthlyIncomeCents}
    />,
  );
  return { onOpenAccount };
}

async function expandFilters() {
  await userEvent.click(screen.getByText('Filtrar lançamentos'));
}

const defaultAccounts = [
  buildAccount({ id: 'a-1', description: 'Água — abril', valueCents: 124000, status: 'pago' }),
  buildAccount({ id: 'a-2', description: 'Jardinagem', valueCents: 45000, status: 'pendente' }),
];

const multiMonthAccounts = [
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

const filterableAccounts = multiMonthAccounts;

describe('AccountsScreen', () => {
  test('renders the account rows once loaded', async () => {
    setup();

    expect(await screen.findByText('Água — abril')).toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
  });

  test('shows the Entradas and Saídas header totals for the latest month', async () => {
    setup(multiMonthAccounts, { '2026-04': 200000, '2026-05': 90000 });

    await screen.findByText('Água — abril');

    expect(screen.getByText('Entradas')).toBeInTheDocument();
    expect(screen.getByText('Saídas')).toBeInTheDocument();
    expect(screen.getByText('900,00')).toBeInTheDocument();
    expect(screen.getByText('450,00')).toBeInTheDocument();
  });

  test('default selected month is the latest available and the subtitle names it', async () => {
    setup(multiMonthAccounts, { '2026-04': 200000, '2026-05': 90000 });

    await screen.findByText('Água — abril');

    expect(screen.getByText('maio')).toBeInTheDocument();
  });

  test('clicking the previous-month arrow recomputes the cards, and next returns', async () => {
    setup(multiMonthAccounts, { '2026-04': 200000, '2026-05': 90000 });
    await screen.findByText('Água — abril');

    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));

    expect(screen.getByText('abril')).toBeInTheDocument();
    expect(screen.getByText('2.000,00')).toBeInTheDocument();
    expect(screen.getByText('1.540,00')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(screen.getByText('maio')).toBeInTheDocument();
    expect(screen.getByText('900,00')).toBeInTheDocument();
    expect(screen.getByText('450,00')).toBeInTheDocument();
  });

  test('the arrow at the earliest month is disabled and does not change the cards', async () => {
    setup(multiMonthAccounts, { '2026-04': 200000, '2026-05': 90000 });
    await screen.findByText('Água — abril');

    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByText('abril')).toBeInTheDocument();

    const previousButton = screen.getByRole('button', { name: 'Mês anterior' });
    expect(previousButton).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(previousButton);
    expect(screen.getByText('abril')).toBeInTheDocument();
    expect(screen.getByText('2.000,00')).toBeInTheDocument();
  });

  test('the filter is collapsed by default', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');

    expect(screen.queryByLabelText('Buscar por nome')).not.toBeInTheDocument();
    expect(screen.getByText('Filtrar lançamentos')).toBeInTheDocument();
  });

  test('clicking Filtrar lançamentos reveals the filter panel', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');

    const toggle = screen.getByText('Filtrar lançamentos').closest('[role="button"]');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await expandFilters();

    expect(screen.getByLabelText('Buscar por nome')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
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
    await expandFilters();

    await userEvent.type(screen.getByLabelText('Buscar por nome'), 'jardin');

    expect(screen.queryByText('Água — abril')).not.toBeInTheDocument();
    expect(screen.queryByText('Energia — abril')).not.toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
  });

  test('clicking a category chip filters to only that category and shows the badge', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');
    await expandFilters();

    await userEvent.click(screen.getByText('Manutenção'));

    expect(screen.queryByText('Água — abril')).not.toBeInTheDocument();
    expect(screen.queryByText('Energia — abril')).not.toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
    expect(screen.getByText('Filtrar lançamentos').closest('div')).toHaveTextContent('1');
  });

  test('setting a date range filters to only in-range rows', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');
    await expandFilters();

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '01/04/2026' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '10/04/2026' } });

    expect(screen.getByText('Água — abril')).toBeInTheDocument();
    expect(screen.queryByText('Energia — abril')).not.toBeInTheDocument();
    expect(screen.queryByText('Jardinagem')).not.toBeInTheDocument();
  });

  test('Limpar filtros only appears when a filter is active, and resets the rows and badge', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');
    await expandFilters();

    expect(screen.queryByText('Limpar filtros')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Manutenção'));

    expect(screen.getByText('Limpar filtros')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Limpar filtros'));

    expect(screen.queryByText('Limpar filtros')).not.toBeInTheDocument();
    expect(screen.getByText('Água — abril')).toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
    expect(screen.getByText('Energia — abril')).toBeInTheDocument();
  });

  test('shows an empty state when no lançamento matches the filters', async () => {
    setup(filterableAccounts);
    await screen.findByText('Água — abril');
    await expandFilters();

    await userEvent.type(screen.getByLabelText('Buscar por nome'), 'inexistente');

    expect(screen.getByText('Nenhum lançamento encontrado com esses filtros.')).toBeInTheDocument();
  });
});
