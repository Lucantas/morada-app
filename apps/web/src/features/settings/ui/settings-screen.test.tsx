import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { InMemorySettingsRepository } from '../data/in-memory-settings-repository';
import { SettingsScreen } from './settings-screen';

function renderScreen(repo: InMemorySettingsRepository) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen repository={repo} onBack={() => {}} />
    </QueryClientProvider>,
  );
}

describe('SettingsScreen', () => {
  it('loads the current fee and saves an edited value as cents', async () => {
    const repo = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    renderScreen(repo);

    await waitFor(() => expect(screen.getByLabelText('Valor da taxa')).toHaveValue('150,00'));

    fireEvent.change(screen.getByLabelText('Valor da taxa'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(repo.snapshot()).toEqual({ monthlyFeeCents: 20000, dueDay: 15 }));
  });
});
