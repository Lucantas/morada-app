import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildAccount } from '@/test/factories.accounts';

import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountEditScreen } from './account-edit-screen';

describe('AccountEditScreen', () => {
  test('creates a new account with parsed value and navigates back', async () => {
    const repository = new InMemoryAccountRepository([]);
    const onBack = jest.fn();
    renderWithClient(<AccountEditScreen repository={repository} onBack={onBack} />);

    await userEvent.type(screen.getByLabelText('Descrição'), 'Reparo portão');
    await userEvent.type(screen.getByLabelText('Categoria'), 'Manutenção');
    await userEvent.type(screen.getByLabelText('Data'), '15/04');
    await userEvent.type(screen.getByLabelText('Valor (R$)'), '1.240,00');
    await userEvent.click(screen.getByRole('button', { name: /registrar conta/i }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    const saved = await repository.list();
    const created = saved.find((a) => a.description === 'Reparo portão');
    expect(created?.valueCents).toBe(124000);
  });

  test('prefills the form when editing an existing account', async () => {
    const repository = new InMemoryAccountRepository([
      buildAccount({
        id: 'a-7',
        description: 'Energia',
        category: 'Utilidades',
        valueCents: 89000,
      }),
    ]);
    renderWithClient(
      <AccountEditScreen repository={repository} accountId="a-7" onBack={jest.fn()} />,
    );

    expect(await screen.findByDisplayValue('Energia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Utilidades')).toBeInTheDocument();
    expect(screen.getByDisplayValue('890,00')).toBeInTheDocument();
  });
});
