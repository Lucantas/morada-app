import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';

import { InMemoryIncomeRepository } from '../data/in-memory-income-repository';

import { IncomeSection } from './income-section';

function setup({ incomes = [] as readonly unknown[] } = {}) {
  const repository = new InMemoryIncomeRepository(incomes);
  const onOpenIncome = jest.fn();
  renderWithClient(<IncomeSection repository={repository} onOpenIncome={onOpenIncome} />);
  return { onOpenIncome };
}

describe('IncomeSection', () => {
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

    expect(await screen.findByText('Aluguel salão de festas')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Aluguel salão de festas'));

    await waitFor(() => expect(onOpenIncome).toHaveBeenCalledWith('i-1'));
  });

  test('clicking "Adicionar" opens a new income', async () => {
    const { onOpenIncome } = setup();

    await userEvent.click(await screen.findByRole('button', { name: /adicionar/i }));

    expect(onOpenIncome).toHaveBeenCalledWith();
  });

  test('shows an empty state when there are no incomes', async () => {
    setup();

    expect(await screen.findByText('Nenhuma entrada registrada')).toBeInTheDocument();
  });
});
