import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildMessage, buildThread } from '@/test/factories.messages';

import { InMemoryThreadRepository } from '../data/in-memory-thread-repository';

import { AdminMessagesScreen } from './admin-messages-screen';

function setup() {
  const repository = new InMemoryThreadRepository([
    buildThread({
      id: 'me',
      residentName: 'Maria Ribeiro',
      unread: false,
      messages: [buildMessage({ id: 'm-1', text: 'Luz da garagem queimada' })],
    }),
    buildThread({
      id: 't-2',
      residentName: 'Ana Costa',
      unread: true,
      messages: [buildMessage({ id: 'm-2', text: 'Posso reservar o salão?' })],
    }),
  ]);
  const onOpenThread = jest.fn();
  renderWithClient(
    <AdminMessagesScreen repository={repository} onOpenThread={onOpenThread} bottomNav={null} />,
  );
  return { onOpenThread };
}

describe('AdminMessagesScreen', () => {
  test('renders the thread list with last message and unread dot', async () => {
    setup();

    expect(await screen.findByText('Maria Ribeiro')).toBeInTheDocument();
    expect(screen.getByText('Ana Costa')).toBeInTheDocument();
    expect(screen.getByText('Posso reservar o salão?')).toBeInTheDocument();
    expect(screen.getByLabelText('Não lida')).toBeInTheDocument();
  });

  test('clicking a thread opens it by id', async () => {
    const { onOpenThread } = setup();

    await userEvent.click(await screen.findByText('Ana Costa'));

    await waitFor(() => expect(onOpenThread).toHaveBeenCalledWith('t-2'));
  });

  test('shows an empty state when there are no conversations', async () => {
    const repository = new InMemoryThreadRepository([]);
    renderWithClient(
      <AdminMessagesScreen repository={repository} onOpenThread={jest.fn()} bottomNav={null} />,
    );
    expect(await screen.findByText('Nenhuma conversa ainda')).toBeInTheDocument();
  });
});
