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
  onOpenTeam,
  onOpenBuilding,
}: {
  settings: SettingsRepository;
  categoryRepo: CategoryRepository;
  condoInfo?: CondoInfoRepository;
  canManageFees?: boolean;
  canManageCondo?: boolean;
  onOpenActivity?: () => void;
  onOpenSindico?: () => void;
  onOpenTeam?: () => void;
  onOpenBuilding?: () => void;
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
      onOpenTeam={onOpenTeam}
      onOpenBuilding={onOpenBuilding}
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

    await waitFor(() =>
      expect(repo.snapshot()).toEqual({
        monthlyFeeCents: 20000,
        dueDay: 15,
        pix: null,
        openingBalance: null,
      }),
    );
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

  test('the administrador opens Estrutura do prédio', async () => {
    const onOpenBuilding = jest.fn();
    renderWithClient(
      <Harness
        settings={new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 })}
        categoryRepo={new InMemoryCategoryRepository([])}
        onOpenBuilding={onOpenBuilding}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Estrutura do prédio' }));

    expect(onOpenBuilding).toHaveBeenCalled();
  });

  test('síndico does not see Estrutura do prédio', async () => {
    renderWithClient(
      <Harness
        settings={new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 })}
        categoryRepo={new InMemoryCategoryRepository([])}
        canManageCondo={false}
        onOpenBuilding={jest.fn()}
      />,
    );

    await screen.findByLabelText('Nome da nova categoria');
    expect(screen.queryByRole('button', { name: 'Estrutura do prédio' })).not.toBeInTheDocument();
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

  test('shows the Equipe row only when an opener is provided and opens it', async () => {
    const onOpenTeam = jest.fn();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    const { unmount } = renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        onOpenTeam={onOpenTeam}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Equipe' }));

    expect(onOpenTeam).toHaveBeenCalled();
    unmount();
    renderWithClient(
      <Harness settings={settings} categoryRepo={new InMemoryCategoryRepository([])} />,
    );
    await screen.findByLabelText('Nome da nova categoria');
    expect(screen.queryByRole('button', { name: 'Equipe' })).not.toBeInTheDocument();
  });
});

describe('SettingsScreen Pix', () => {
  const storedPix = {
    keyType: 'email' as const,
    key: 'a@b.com',
    receiverName: 'Condominio Morada',
    city: 'Sao Paulo',
  };

  test('a fee-only save never erases the stored Pix key', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({
      monthlyFeeCents: 15000,
      dueDay: 15,
      pix: storedPix,
    });
    renderScreen(settings);

    await screen.findByDisplayValue('a@b.com');
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    await screen.findByText(/configurações salvas/i);
    expect(settings.snapshot().pix).toEqual(storedPix);
  });

  test('saves a new Pix key with normalization', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    renderScreen(settings);

    await user.selectOptions(await screen.findByLabelText('Tipo de chave Pix'), 'cpf');
    await user.type(screen.getByLabelText('Chave Pix'), '529.982.247-25');
    await user.type(screen.getByLabelText('Nome do recebedor'), 'Condominio Morada');
    await user.type(screen.getByLabelText('Cidade'), 'Sao Paulo');
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    await screen.findByText(/configurações salvas/i);
    expect(settings.snapshot().pix).toEqual({
      keyType: 'cpf',
      key: '52998224725',
      receiverName: 'Condominio Morada',
      city: 'Sao Paulo',
    });
  });

  test('shows the validation message for an invalid key and does not save', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({ monthlyFeeCents: 15000, dueDay: 15 });
    renderScreen(settings);

    await user.type(await screen.findByLabelText('Chave Pix'), '123');
    await user.type(screen.getByLabelText('Nome do recebedor'), 'Morada');
    await user.type(screen.getByLabelText('Cidade'), 'Sao Paulo');
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    expect(await screen.findByText('Chave Pix inválida')).toBeInTheDocument();
    expect(settings.snapshot().pix).toBeNull();
  });

  test('Remover chave clears the stored Pix on save', async () => {
    const user = userEvent.setup();
    const settings = new InMemorySettingsRepository({
      monthlyFeeCents: 15000,
      dueDay: 15,
      pix: storedPix,
    });
    renderScreen(settings);

    await screen.findByDisplayValue('a@b.com');
    await user.click(screen.getByRole('button', { name: 'Remover chave' }));
    await user.click(screen.getByRole('button', { name: /salvar e reclassificar/i }));

    await screen.findByText(/configurações salvas/i);
    expect(settings.snapshot().pix).toBeNull();
  });

  test('the síndico sees the Pix key read-only', async () => {
    const settings = new InMemorySettingsRepository({
      monthlyFeeCents: 15000,
      dueDay: 15,
      pix: storedPix,
    });
    renderWithClient(
      <Harness
        settings={settings}
        categoryRepo={new InMemoryCategoryRepository([])}
        canManageFees={false}
        canManageCondo={false}
      />,
    );

    expect(await screen.findByText('a@b.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Chave Pix')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover chave' })).not.toBeInTheDocument();
  });
});
