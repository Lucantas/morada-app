import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { InMemoryIncomeRepository } from '@/features/income/data/in-memory-income-repository';

import { IncomeEditScreen } from './income-edit-screen';

describe('IncomeEditScreen', () => {
  test('creates a new income with the entered fields and navigates back', async () => {
    const repository = new InMemoryIncomeRepository([]);
    const onBack = jest.fn();
    renderWithClient(<IncomeEditScreen repository={repository} onBack={onBack} />);

    await userEvent.type(screen.getByLabelText('Descrição'), 'Aluguel salão de festas');
    await userEvent.type(screen.getByLabelText('Origem'), 'Salão de festas');
    await userEvent.type(screen.getByLabelText('Valor'), '35000');
    await userEvent.click(screen.getByRole('button', { name: /salvar entrada/i }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    const saved = await repository.list();
    const created = saved.find((income) => income.description === 'Aluguel salão de festas');
    expect(created).toMatchObject({ source: 'Salão de festas', valueCents: 35000 });
  });

  test('deletes an existing income after confirming', async () => {
    const repository = new InMemoryIncomeRepository([
      {
        id: 'income-1',
        description: 'Aluguel salão',
        source: 'Salão de festas',
        date: '2026-04-10',
        valueCents: 20000,
      },
    ]);
    const onBack = jest.fn();
    renderWithClient(
      <IncomeEditScreen incomeId="income-1" repository={repository} onBack={onBack} />,
    );

    expect(await screen.findByDisplayValue('Aluguel salão')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /excluir entrada/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    const remaining = await repository.list();
    expect(remaining.find((income) => income.id === 'income-1')).toBeUndefined();
  });
});
