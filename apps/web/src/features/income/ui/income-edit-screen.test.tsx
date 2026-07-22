import { fireEvent, screen, waitFor } from '@testing-library/react';
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
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '10/05/2026' } });
    await userEvent.type(screen.getByLabelText('Valor'), '35000');
    await userEvent.click(screen.getByRole('button', { name: /salvar entrada/i }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    const saved = await repository.list();
    const created = saved.find((income) => income.description === 'Aluguel salão de festas');
    expect(created).toMatchObject({ source: 'Salão de festas', valueCents: 35000 });
  });

  test('shows a validation error and does not save when the date is blank', async () => {
    const repository = new InMemoryIncomeRepository([]);
    const onBack = jest.fn();
    renderWithClient(<IncomeEditScreen repository={repository} onBack={onBack} />);

    await userEvent.type(screen.getByLabelText('Descrição'), 'Aluguel salão de festas');
    await userEvent.type(screen.getByLabelText('Origem'), 'Salão de festas');
    await userEvent.type(screen.getByLabelText('Valor'), '35000');
    await userEvent.click(screen.getByRole('button', { name: /salvar entrada/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Preencha descrição, origem, um valor maior que zero e uma data válida.',
    );
    expect(await repository.list()).toHaveLength(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  test('shows a validation error and does not save when the date is invalid', async () => {
    const repository = new InMemoryIncomeRepository([]);
    const onBack = jest.fn();
    renderWithClient(<IncomeEditScreen repository={repository} onBack={onBack} />);

    await userEvent.type(screen.getByLabelText('Descrição'), 'Aluguel salão de festas');
    await userEvent.type(screen.getByLabelText('Origem'), 'Salão de festas');
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '31/02/2026' } });
    await userEvent.type(screen.getByLabelText('Valor'), '35000');
    await userEvent.click(screen.getByRole('button', { name: /salvar entrada/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Preencha descrição, origem, um valor maior que zero e uma data válida.',
    );
    expect(await repository.list()).toHaveLength(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  test('renders a proof link pointing at the serving endpoint when the income has a proof', async () => {
    const repository = new InMemoryIncomeRepository([
      {
        id: 'income-1',
        description: 'Aluguel salão',
        source: 'Salão de festas',
        date: '2026-04-10',
        valueCents: 20000,
        hasProof: true,
      },
    ]);
    renderWithClient(
      <IncomeEditScreen incomeId="income-1" repository={repository} onBack={jest.fn()} />,
    );

    expect(await screen.findByDisplayValue('Aluguel salão')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver comprovante/i })).toHaveAttribute(
      'href',
      '/api/incomes/income-1/proof',
    );
  });

  test('does not render a proof link when the income has no proof', async () => {
    const repository = new InMemoryIncomeRepository([
      {
        id: 'income-1',
        description: 'Aluguel salão',
        source: 'Salão de festas',
        date: '2026-04-10',
        valueCents: 20000,
      },
    ]);
    renderWithClient(
      <IncomeEditScreen incomeId="income-1" repository={repository} onBack={jest.fn()} />,
    );

    expect(await screen.findByDisplayValue('Aluguel salão')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ver comprovante/i })).not.toBeInTheDocument();
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
