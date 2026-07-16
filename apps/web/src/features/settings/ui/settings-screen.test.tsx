import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { CategoryRepository } from '@/features/categories/domain/category-repository';
import { InMemoryCategoryRepository } from '@/features/categories/data/in-memory-category-repository';
import { useCategories, useSaveCategories } from '@/features/categories/ui/use-categories';

import type { SettingsRepository } from '../domain/settings-repository';
import { InMemorySettingsRepository } from '../data/in-memory-settings-repository';
import { SettingsScreen } from './settings-screen';

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function Harness({
  settings,
  categoryRepo,
}: {
  settings: SettingsRepository;
  categoryRepo: CategoryRepository;
}) {
  const categories = useCategories(categoryRepo);
  const saveCategories = useSaveCategories(categoryRepo);
  return (
    <SettingsScreen
      repository={settings}
      categories={categories.data}
      categoriesError={categories.isError}
      categoriesReady={categories.isSuccess}
      savingCategories={saveCategories.isPending}
      onSaveCategories={(drafts) => saveCategories.mutateAsync(drafts)}
      onBack={() => {}}
    />
  );
}

function renderScreen(
  repo: InMemorySettingsRepository,
  categoryRepo: CategoryRepository = new InMemoryCategoryRepository([]),
) {
  return renderWithClient(<Harness settings={repo} categoryRepo={categoryRepo} />);
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
    renderWithClient(<Harness settings={settings} categoryRepo={categories} />);

    await screen.findByText('Ajustes');
    await user.type(screen.getByLabelText('Nome da nova categoria'), 'Energia');
    await user.type(screen.getByLabelText('Palavras-chave da nova categoria'), 'luz, energia');
    await user.click(screen.getByRole('button', { name: /adicionar categoria/i }));
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    expect(await screen.findByText(/2 contas foram reclassificadas/i)).toBeInTheDocument();
  });

  test('shows a save error and no success message when saving categories rejects', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const categories = new InMemoryCategoryRepository([]);
    jest.spyOn(categories, 'save').mockRejectedValue(new Error('Falha ao salvar categorias'));
    renderWithClient(<Harness settings={settings} categoryRepo={categories} />);

    await screen.findByText('Ajustes');
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar categorias');
    expect(screen.queryByText(/reclassificada/i)).not.toBeInTheDocument();
  });

  test('disables save until settings and categories both finish loading, and seeds loaded categories', async () => {
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const categories = new InMemoryCategoryRepository([
      { id: 'c1', name: 'Água', keywords: 'agua, saneamento', position: 0 },
    ]);
    renderWithClient(<Harness settings={settings} categoryRepo={categories} />);

    expect(screen.getByRole('button', { name: /salvar e reclassificar/i })).toBeDisabled();

    expect(await screen.findByDisplayValue('Água')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /salvar e reclassificar/i })).toBeEnabled(),
    );
  });
});
