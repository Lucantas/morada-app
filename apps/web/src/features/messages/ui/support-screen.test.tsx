import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildMessage, buildThread } from '@/test/factories.messages';

import { InMemoryThreadRepository } from '../data/in-memory-thread-repository';

import { SupportScreen } from './support-screen';

function setup() {
  const repository = new InMemoryThreadRepository([
    buildThread({
      id: 'me',
      residentName: 'Maria Ribeiro',
      messages: [buildMessage({ id: 'm-1', author: 'admin', text: 'Oi Maria, tudo certo?' })],
    }),
  ]);
  renderWithClient(<SupportScreen repository={repository} threadId="me" bottomNav={null} />);
  return { repository };
}

describe('SupportScreen', () => {
  test('renders the support title and existing bubbles', async () => {
    setup();

    expect(screen.getByText('Falar com o síndico')).toBeInTheDocument();
    expect(await screen.findByText('Oi Maria, tudo certo?')).toBeInTheDocument();
  });

  test('the resident can post a message', async () => {
    const { repository } = setup();
    await screen.findByText('Oi Maria, tudo certo?');

    await userEvent.type(screen.getByLabelText('Mensagem'), 'A luz da garagem queimou');
    await userEvent.click(screen.getByRole('button', { name: /responder/i }));

    await waitFor(async () => {
      const saved = await repository.getById('me');
      expect(
        saved?.messages.some(
          (m) => m.text === 'A luz da garagem queimou' && m.author === 'resident',
        ),
      ).toBe(true);
    });
    expect(screen.getByLabelText('Mensagem')).toHaveValue('');
  });
});
