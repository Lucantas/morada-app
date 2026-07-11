import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildNotice } from '@/test/factories.notices';

import { InMemoryNoticeRepository } from '../data/in-memory-notice-repository';

import { NoticesScreen } from './notices-screen';

describe('NoticesScreen', () => {
  test('renders the active notices once loaded', async () => {
    const repository = new InMemoryNoticeRepository([
      buildNotice({ id: 'n-1', title: 'Portão da garagem', dismissed: false }),
      buildNotice({ id: 'n-2', title: 'Assembleia', dismissed: false }),
      buildNotice({ id: 'n-3', title: 'Dispensado', dismissed: true }),
    ]);
    renderWithClient(<NoticesScreen repository={repository} bottomNav={null} />);

    expect(await screen.findByText('Portão da garagem')).toBeInTheDocument();
    expect(screen.getByText('Assembleia')).toBeInTheDocument();
    expect(screen.queryByText('Dispensado')).not.toBeInTheDocument();
  });

  test('shows the empty state when there are no active notices', async () => {
    const repository = new InMemoryNoticeRepository([buildNotice({ id: 'n-1', dismissed: true })]);
    renderWithClient(<NoticesScreen repository={repository} bottomNav={null} />);

    expect(await screen.findByText('Nenhum aviso no momento.')).toBeInTheDocument();
  });

  test('dismissing a notice removes it from the active list', async () => {
    const repository = new InMemoryNoticeRepository([
      buildNotice({ id: 'n-1', title: 'Portão da garagem', dismissed: false }),
      buildNotice({ id: 'n-2', title: 'Assembleia', dismissed: false }),
    ]);
    renderWithClient(<NoticesScreen repository={repository} bottomNav={null} />);

    await screen.findByText('Portão da garagem');
    const dismissButtons = screen.getAllByRole('button', { name: 'Dispensar' });
    await userEvent.click(dismissButtons[0] as HTMLElement);

    await waitFor(() => expect(screen.queryByText('Portão da garagem')).not.toBeInTheDocument());
    expect(screen.getByText('Assembleia')).toBeInTheDocument();
  });

  test('clearing all dismisses every active notice', async () => {
    const repository = new InMemoryNoticeRepository([
      buildNotice({ id: 'n-1', title: 'Portão da garagem', dismissed: false }),
      buildNotice({ id: 'n-2', title: 'Assembleia', dismissed: false }),
    ]);
    renderWithClient(<NoticesScreen repository={repository} bottomNav={null} />);

    await screen.findByText('Portão da garagem');
    await userEvent.click(screen.getByRole('button', { name: /limpar todos/i }));

    expect(await screen.findByText('Nenhum aviso no momento.')).toBeInTheDocument();
  });
});
