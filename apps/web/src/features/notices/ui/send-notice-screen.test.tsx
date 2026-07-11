import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';

import { InMemoryNoticeRepository } from '../data/in-memory-notice-repository';

import { SendNoticeScreen } from './send-notice-screen';

describe('SendNoticeScreen', () => {
  test('filling the form and sending saves the notice and calls onSent', async () => {
    const repository = new InMemoryNoticeRepository([]);
    const onSent = jest.fn();
    renderWithClient(
      <SendNoticeScreen repository={repository} onSent={onSent} onBack={jest.fn()} />,
    );

    await userEvent.type(screen.getByLabelText('Título'), 'Portão da garagem');
    await userEvent.type(screen.getByLabelText('Mensagem'), 'Técnico agendado para quinta.');
    await userEvent.click(screen.getByRole('button', { name: /enviar aviso/i }));

    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const saved = await repository.list();
    expect(saved.map((n) => n.title)).toContain('Portão da garagem');
    expect(saved[0]?.dismissed).toBe(false);
  });

  test('does not send when title and body are empty', async () => {
    const repository = new InMemoryNoticeRepository([]);
    const onSent = jest.fn();
    renderWithClient(
      <SendNoticeScreen repository={repository} onSent={onSent} onBack={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /enviar aviso/i }));

    expect(onSent).not.toHaveBeenCalled();
    expect(await repository.list()).toHaveLength(0);
    expect(screen.getByText(/preencha o título e a mensagem/i)).toBeInTheDocument();
  });

  test('back button calls onBack', async () => {
    const onBack = jest.fn();
    renderWithClient(
      <SendNoticeScreen
        repository={new InMemoryNoticeRepository([])}
        onSent={jest.fn()}
        onBack={onBack}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(onBack).toHaveBeenCalled();
  });
});
