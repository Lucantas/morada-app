import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildMessage, buildThread } from '@/test/factories.messages';

import { InMemoryThreadRepository } from '../data/in-memory-thread-repository';

import { ThreadScreen } from './thread-screen';

function setup() {
  const repository = new InMemoryThreadRepository([
    buildThread({
      id: 't-1',
      residentName: 'Ana Costa',
      unread: true,
      messages: [
        buildMessage({ id: 'm-1', author: 'resident', text: 'Preciso de ajuda' }),
        buildMessage({ id: 'm-2', author: 'admin', text: 'Como posso ajudar?' }),
      ],
    }),
  ]);
  const onBack = jest.fn();
  renderWithClient(<ThreadScreen repository={repository} threadId="t-1" onBack={onBack} />);
  return { repository, onBack };
}

describe('ThreadScreen', () => {
  test('renders the resident name in the header and the chat bubbles', async () => {
    setup();

    expect(await screen.findByText('Ana Costa')).toBeInTheDocument();
    expect(screen.getByText('Preciso de ajuda')).toBeInTheDocument();
    expect(screen.getByText('Como posso ajudar?')).toBeInTheDocument();
  });

  test('marks the thread as read on mount', async () => {
    const { repository } = setup();

    await waitFor(async () => {
      expect((await repository.getById('t-1'))?.unread).toBe(false);
    });
  });

  test('sending a reply posts as admin and clears the input', async () => {
    const { repository } = setup();
    await screen.findByText('Ana Costa');

    const input = screen.getByLabelText('Mensagem');
    await userEvent.type(input, 'Vamos resolver');
    await userEvent.click(screen.getByRole('button', { name: /responder/i }));

    await waitFor(async () => {
      const saved = await repository.getById('t-1');
      expect(saved?.messages.some((m) => m.text === 'Vamos resolver' && m.author === 'admin')).toBe(
        true,
      );
    });
    expect(screen.getByLabelText('Mensagem')).toHaveValue('');
  });
});
