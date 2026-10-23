import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { CategoryRepository } from '@/features/categories/domain/category-repository';
import { InMemoryCategoryRepository } from '@/features/categories/data/in-memory-category-repository';
import { useCategories, useSaveCategories } from '@/features/categories/ui/use-categories';

import { InMemoryCondoInfoRepository } from '@/features/condos/data/in-memory-condo-info-repository';
import type { CondoInfoRepository } from '@/features/condos/domain/condo-info-repository';
import { useCondoInfo, useRenameCondo } from '@/features/condos/ui/use-condo-info';
import { useCondoScope } from '@/shared/lib/condo-scope';
import { clearTestCondo, setTestCondo, TEST_CONDO_NAME } from '@/test/condo';

import type { SettingsRepository } from '../domain/settings-repository';
import { InMemorySettingsRepository } from '../data/in-memory-settings-repository';
import { SettingsScreen } from './settings-screen';

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const defaultCondoInfo = () => new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });

beforeEach(() => setTestCondo());
afterEach(() => clearTestCondo());

function Harness({
  settings,
  categoryRepo,
  condoInfo = defaultCondoInfo(),
  canManageFees = true,
  canManageCondo = true,
  onOpenActivity,
  onOpenSindico,
}: {
  settings: SettingsRepository;
  categoryRepo: CategoryRepository;
  condoInfo?: CondoInfoRepository;
  canManageFees?: boolean;
  canManageCondo?: boolean;
  onOpenActivity?: () => void;
  onOpenSindico?: () => void;
}) {
  const categories = useCategories(categoryRepo);
  const saveCategories = useSaveCategories(categoryRepo);
  const info = useCondoInfo(condoInfo);
  const rename = useRenameCondo(condoInfo);
  return (
    <SettingsScreen
      repository={settings}
      condoName={info.data?.name}
      savingCondoName={rename.isPending}
      onRenameCondo={(name) => rename.mutateAsync(name)}
      categories={categories.data}
      categoriesError={categories.isError}
      categoriesReady={categories.isSuccess}
      savingCategories={saveCategories.isPending}
      onSaveCategories={(drafts) => saveCategories.mutateAsync(drafts)}
      canManageFees={canManageFees}
      canManageCondo={canManageCondo}
      onOpenActivity={onOpenActivity}
      onOpenSindico={onOpenSindico}
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

describe('SettingsScreen permissions', () => {
  test('sindico sees fee fields read-only', async () => {
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        canManageFees={false}
        canManageCondo={false}
      />,
    );

    expect(await screen.findByText('R$ 150,00')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Valor da taxa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nome do condomínio' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome da nova categoria')).toBeInTheDocument();
  });
});

describe('SettingsScreen read-only condo name', () => {
  test('saves without a condominium name error when the person cannot manage the condo', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const condoInfo: CondoInfoRepository = {
      get: () => Promise.reject(new Error('offline')),
      rename: () => Promise.reject(new Error('offline')),
    };
    act(() => useCondoScope.getState().setCondo(null));
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        condoInfo={condoInfo}
        canManageFees={false}
        canManageCondo={false}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /salvar e reclassificar/i }));

    await screen.findByText(/configurações salvas/i);
    expect(screen.queryByText('Informe o nome do condomínio')).not.toBeInTheDocument();
  });
});

describe('SettingsScreen', () => {
  test('renames the condominium', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const condoInfo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        condoInfo={condoInfo}
      />,
    );

    const field = await screen.findByDisplayValue(TEST_CONDO_NAME);
    await user.clear(field);
    await user.type(field, 'Edifício Aurora');
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    await waitFor(() => expect(condoInfo.snapshot().name).toBe('Edifício Aurora'));
    await waitFor(() => expect(useCondoScope.getState().condo?.name).toBe('Edifício Aurora'));
  });

  test('does not rename when the name is unchanged', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const condoInfo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });
    const rename = jest.spyOn(condoInfo, 'rename');
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        condoInfo={condoInfo}
      />,
    );

    await screen.findByDisplayValue(TEST_CONDO_NAME);
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    await screen.findByText(/configurações salvas/i);
    expect(rename).not.toHaveBeenCalled();
  });

  test('saves settings even when the condominium info query fails', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const condoInfo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });
    jest.spyOn(condoInfo, 'get').mockRejectedValue(new Error('offline'));
    const rename = jest.spyOn(condoInfo, 'rename');
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        condoInfo={condoInfo}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Valor da taxa')).toHaveValue('150,00'));
    fireEvent.change(screen.getByLabelText('Valor da taxa'), { target: { value: '20000' } });
    const save = screen.getByRole('button', { name: /salvar e reclassificar/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => expect(settings.snapshot().monthlyFeeCents).toBe(20000));
    expect(rename).not.toHaveBeenCalled();
  });

  test.each([
    ['   ', 'Informe o nome do condomínio'],
    ['x'.repeat(81), 'Nome muito longo'],
  ])('rejects an invalid condominium name inline without saving (%#)', async (name, message) => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const condoInfo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });
    const rename = jest.spyOn(condoInfo, 'rename');
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        condoInfo={condoInfo}
      />,
    );

    const field = await screen.findByDisplayValue(TEST_CONDO_NAME);
    fireEvent.change(field, { target: { value: name } });
    fireEvent.change(screen.getByLabelText('Valor da taxa'), { target: { value: '20000' } });
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(rename).not.toHaveBeenCalled();
    expect(settings.snapshot().monthlyFeeCents).toBe(15000);
  });

  test('shows an error and keeps the old name when the rename is rejected', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const condoInfo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });
    jest.spyOn(condoInfo, 'rename').mockRejectedValue(new Error('Acesso negado'));
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        condoInfo={condoInfo}
      />,
    );

    const field = await screen.findByDisplayValue(TEST_CONDO_NAME);
    await user.clear(field);
    await user.type(field, 'Outro');
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado');
    expect(useCondoScope.getState().condo?.name).toBe(TEST_CONDO_NAME);
  });

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

  test('shows the Atividade row only when an opener is provided and opens it', async () => {
    const onOpenActivity = jest.fn();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const { unmount } = renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        onOpenActivity={onOpenActivity}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Atividade' }));

    expect(onOpenActivity).toHaveBeenCalled();
    unmount();
    renderWithClient(
      <Harness settings={settings} categoryRepo={new InMemoryCategoryRepository([])} />,
    );
    await screen.findByLabelText('Nome da nova categoria');
    expect(screen.queryByRole('button', { name: 'Atividade' })).not.toBeInTheDocument();
  });

  test('shows the Síndico row only when an opener is provided and opens it', async () => {
    const onOpenSindico = jest.fn();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const { unmount } = renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        onOpenSindico={onOpenSindico}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Síndico' }));

    expect(onOpenSindico).toHaveBeenCalled();
    unmount();
    renderWithClient(
      <Harness settings={settings} categoryRepo={new InMemoryCategoryRepository([])} />,
    );
    await screen.findByLabelText('Nome da nova categoria');
    expect(screen.queryByRole('button', { name: 'Síndico' })).not.toBeInTheDocument();
  });
});
