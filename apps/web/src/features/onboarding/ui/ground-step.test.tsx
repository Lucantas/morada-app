import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { groundInputFromForm, initialGroundForm, type GroundForm } from '../domain/ground-form';

import { GroundStep } from './ground-step';

const NAMES = ['Água', 'Energia', 'Serviços'];

function Harness({ onForm }: { onForm: (form: GroundForm) => void }) {
  const [form, setForm] = useState(initialGroundForm(NAMES));
  return (
    <GroundStep
      form={form}
      onChange={(next) => {
        setForm(next);
        onForm(next);
      }}
    />
  );
}

function renderStep() {
  const onForm = jest.fn<void, [GroundForm]>();
  render(<Harness onForm={onForm} />);
  const last = () => {
    const form = onForm.mock.calls.at(-1)?.[0];
    return form ? groundInputFromForm(form) : null;
  };
  return { last };
}

describe('GroundStep', () => {
  test('category chips toggle', async () => {
    const user = userEvent.setup();
    const { last } = renderStep();
    const contas = within(screen.getByRole('group', { name: 'Contas' }));

    expect(contas.getByRole('button', { name: 'Água' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(contas.getByRole('button', { name: 'Água' }));

    expect(contas.getByRole('button', { name: 'Água' })).toHaveAttribute('aria-pressed', 'false');
    expect(last()?.categories).toEqual(['Energia', 'Serviços']);
    expect(screen.queryByLabelText('Água')).not.toBeInTheDocument();
  });

  test('adds another category', async () => {
    const user = userEvent.setup();
    const { last } = renderStep();

    await user.click(screen.getByRole('button', { name: '+ Outra' }));
    await user.type(screen.getByLabelText('Outra conta'), 'Limpeza');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(last()?.categories).toEqual([...NAMES, 'Limpeza']);
    expect(screen.getByRole('button', { name: 'Limpeza' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Outra conta')).not.toBeInTheDocument();
  });

  test('a repeated category shows an error', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('button', { name: '+ Outra' }));
    await user.type(screen.getByLabelText('Outra conta'), 'água');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Essa conta já está na lista.');
  });

  test('spend per category, total only, or later', async () => {
    const user = userEvent.setup();
    const { last } = renderStep();
    const gasto = within(screen.getByRole('group', { name: 'Gasto no mês' }));

    await user.type(gasto.getByLabelText('Água'), '34800');
    expect(last()?.spend).toEqual({
      kind: 'byCategory',
      items: [
        { category: 'Água', cents: 34800 },
        { category: 'Energia', cents: 0 },
        { category: 'Serviços', cents: 0 },
      ],
    });

    await user.click(gasto.getByRole('button', { name: 'Só sei o total' }));
    await user.type(gasto.getByLabelText('Total do mês'), '50000');
    expect(last()?.spend).toEqual({ kind: 'total', cents: 50000 });

    await user.click(gasto.getByRole('button', { name: 'Só sei o total' }));
    expect(gasto.getByLabelText('Água')).toBeInTheDocument();

    await user.click(gasto.getByRole('button', { name: 'Depois eu vejo' }));
    expect(last()?.spend).toEqual({ kind: 'none' });
    expect(gasto.queryByLabelText('Água')).not.toBeInTheDocument();

    await user.click(gasto.getByRole('button', { name: 'Depois eu vejo' }));
    expect(gasto.getByLabelText('Água')).toBeInTheDocument();
  });

  test('cash today: a value, empty or later', async () => {
    const user = userEvent.setup();
    const { last } = renderStep();
    const caixa = within(screen.getByRole('group', { name: 'Em caixa hoje' }));

    await user.type(caixa.getByLabelText('Valor em caixa'), '1230000');
    expect(last()?.cashCents).toBe(1230000);

    await user.click(caixa.getByRole('button', { name: 'Está vazio' }));
    expect(last()?.cashCents).toBe(0);
    expect(caixa.getByRole('button', { name: 'Está vazio' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(caixa.getByRole('button', { name: 'Depois eu vejo' }));
    expect(last()?.cashCents).toBeNull();
    expect(caixa.queryByLabelText('Valor em caixa')).not.toBeInTheDocument();

    await user.click(caixa.getByRole('button', { name: 'Depois eu vejo' }));
    expect(caixa.getByLabelText('Valor em caixa')).toBeInTheDocument();
  });

  test('typing R$ 0,00 as cash means an empty till', async () => {
    const user = userEvent.setup();
    const { last } = renderStep();
    const caixa = within(screen.getByRole('group', { name: 'Em caixa hoje' }));

    await user.type(caixa.getByLabelText('Valor em caixa'), '0');

    expect(last()?.cashCents).toBe(0);
  });
});
