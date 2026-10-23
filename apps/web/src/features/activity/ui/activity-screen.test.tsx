import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { clearTestCondo, setTestCondo } from '@/test/condo';

import type { ActivityEntry } from '../domain/activity';
import type { ActivityRepository } from '../domain/activity-repository';

import { ActivityScreen } from './activity-screen';

const repositoryOf = (entries: ActivityEntry[]): ActivityRepository => ({
  list: async () => entries,
});

beforeEach(() => setTestCondo());
afterEach(() => clearTestCondo());

describe('ActivityScreen', () => {
  test('renders the label, the actor and a dd/mm HH:mm time', async () => {
    const repository = repositoryOf([
      {
        id: 'a-1',
        action: 'account.created',
        label: 'Conta lançada',
        actorName: 'Síndica Teste',
        subjectId: null,
        at: new Date(2026, 4, 3, 14, 5).toISOString(),
      },
    ]);

    renderWithClient(<ActivityScreen repository={repository} onBack={jest.fn()} />);

    expect(await screen.findByText('Conta lançada')).toBeInTheDocument();
    expect(screen.getByText('Síndica Teste · 03/05 14:05')).toBeInTheDocument();
  });

  test('shows the empty state when there is no activity', async () => {
    renderWithClient(<ActivityScreen repository={repositoryOf([])} onBack={jest.fn()} />);

    expect(await screen.findByText('Nenhuma atividade ainda.')).toBeInTheDocument();
  });

  test('shows an error state when loading fails', async () => {
    const repository: ActivityRepository = {
      list: async () => {
        throw new Error('boom');
      },
    };

    renderWithClient(<ActivityScreen repository={repository} onBack={jest.fn()} />);

    expect(await screen.findByText('Não foi possível carregar a atividade.')).toBeInTheDocument();
  });

  test('the back button calls onBack', async () => {
    const onBack = jest.fn();
    renderWithClient(<ActivityScreen repository={repositoryOf([])} onBack={onBack} />);

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(onBack).toHaveBeenCalled();
  });
});
