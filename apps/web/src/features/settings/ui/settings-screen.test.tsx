import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { InMemoryCategoryRepository } from '@/features/categories/data/in-memory-category-repository';

import { InMemorySettingsRepository } from '../data/in-memory-settings-repository';
import { SettingsScreen } from './settings-screen';

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function renderScreen(repo: InMemorySettingsRepository) {
  return renderWithClient(
    <SettingsScreen
      repository={repo}
      categoryRepository={new InMemoryCategoryRepository([])}
      onBack={() => {}}
    />,
  );
}

describe('SettingsScreen', () => {
  it('loads the current fee and saves an edited value as cents', async () => {
    const repo = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    renderScreen(repo);

    await waitFor(() => expect(screen.getByLabelText('Valor da taxa')).toHaveValue('150,00'));

    fireEvent.change(screen.getByLabelText('Valor da taxa'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(repo.snapshot()).toEqual({ monthlyFeeCents: 20000, dueDay: 15 }));
  });

  test('adds a category and shows the reclassified count after saving', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const categories = new InMemoryCategoryRepository([]);
    jest.spyOn(categories, 'save').mockResolvedValue({
      categories: [{ id: 'c1', name: 'Energia', keywords: 'luz', position: 0 }],
      reclassified: 2,
    });
    renderWithClient(
      <SettingsScreen repository={settings} categoryRepository={categories} onBack={jest.fn()} />,
    );

    await screen.findByText('Ajustes');
    await user.type(screen.getByLabelText('Nome da nova categoria'), 'Energia');
    await user.type(screen.getByLabelText('Palavras-chave da nova categoria'), 'luz, energia');
    await user.click(screen.getByRole('button', { name: /adicionar categoria/i }));
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    expect(await screen.findByText(/2 contas foram reclassificadas/i)).toBeInTheDocument();
  });
});
