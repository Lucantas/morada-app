import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildAccount } from '@/test/factories.accounts';

import type { AccountRepository } from '../domain/account-repository';
import { InMemoryAccountRepository } from '../data/in-memory-account-repository';

import { AccountEditScreen } from './account-edit-screen';

function makeSpyRepo(): { repo: AccountRepository; saved: unknown[] } {
  const saved: unknown[] = [];
  const repo: AccountRepository = {
    list: async () => [],
    getById: async () => null,
    save: async (account) => {
      saved.push(account);
      return account;
    },
    archive: async () => undefined,
  };
  return { repo, saved };
}

describe('AccountEditScreen', () => {
  test('creates a new account with the typed amount in cents and navigates back', async () => {
    const repository = new InMemoryAccountRepository([]);
    const onBack = jest.fn();
    renderWithClient(<AccountEditScreen repository={repository} onBack={onBack} />);

    await userEvent.type(screen.getByLabelText('Descrição'), 'Reparo portão');
    await userEvent.type(screen.getByLabelText('Categoria'), 'Manutenção');
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-04-15' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '124000' } });
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

  it('saves the typed amount as integer cents', async () => {
    const { repo, saved } = makeSpyRepo();
    renderWithClient(<AccountEditScreen repository={repo} onBack={() => {}} />);

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Água — abril' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Utilidades' } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-04-25' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '124000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar conta' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ valueCents: 124000, date: '2026-04-25', status: 'pendente' });
  });

  test('does not show the Excluir button when creating a new account', async () => {
    const repository = new InMemoryAccountRepository([]);
    renderWithClient(<AccountEditScreen repository={repository} onBack={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();
  });

  test('archives the account after confirmation and navigates back', async () => {
    const user = userEvent.setup();
    const repository = new InMemoryAccountRepository([
      buildAccount({ id: 'a-7', description: 'Energia', category: 'Utilidades' }),
    ]);
    const archiveSpy = jest.spyOn(repository, 'archive');
    const onBack = jest.fn();
    renderWithClient(<AccountEditScreen repository={repository} accountId="a-7" onBack={onBack} />);

    await screen.findByDisplayValue('Energia');
    await user.click(screen.getByRole('button', { name: /excluir/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(archiveSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(archiveSpy).toHaveBeenCalledWith('a-7'));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  test('cancelling the delete confirmation does not archive the account', async () => {
    const user = userEvent.setup();
    const repository = new InMemoryAccountRepository([
      buildAccount({ id: 'a-7', description: 'Energia', category: 'Utilidades' }),
    ]);
    const archiveSpy = jest.spyOn(repository, 'archive');
    renderWithClient(
      <AccountEditScreen repository={repository} accountId="a-7" onBack={jest.fn()} />,
    );

    await screen.findByDisplayValue('Energia');
    await user.click(screen.getByRole('button', { name: /excluir/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(archiveSpy).not.toHaveBeenCalled();
  });
});
