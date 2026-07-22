import { useEffect, useState } from 'react';

import type { Category, CategoryDraft } from '@/features/categories/domain/category';
import { MoneyInput } from '@/shared/ui/money-input';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';

import type { SettingsRepository } from '../domain/settings-repository';
import { useSettings, useSaveSettings } from './use-settings';
import { SettingsSkeleton } from './settings-skeleton';

type Props = {
  repository: SettingsRepository;
  categories: readonly Category[] | undefined;
  categoriesError: boolean;
  categoriesReady: boolean;
  savingCategories: boolean;
  onSaveCategories: (drafts: CategoryDraft[]) => Promise<{ reclassified: number }>;
  onBack: () => void;
};

function reclassifiedMessage(count: number): string {
  if (count === 0) return 'Configurações salvas. Nenhuma conta precisou ser reclassificada.';
  if (count === 1) return 'Pronto — 1 conta foi reclassificada.';
  return `Pronto — ${count} contas foram reclassificadas.`;
}

export function SettingsScreen({
  repository,
  categories,
  categoriesError,
  categoriesReady,
  savingCategories,
  onSaveCategories,
  onBack,
}: Props) {
  const settings = useSettings(repository);
  const saveSettings = useSaveSettings(repository);

  const [feeCents, setFeeCents] = useState(0);
  const [dueDay, setDueDay] = useState('15');
  const [localCategories, setLocalCategories] = useState<CategoryDraft[]>([]);
  const [newCat, setNewCat] = useState<CategoryDraft>({ name: '', keywords: '' });
  const [reclassifiedMsg, setReclassifiedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setFeeCents(settings.data.monthlyFeeCents);
      setDueDay(String(settings.data.dueDay));
    }
  }, [settings.data]);

  useEffect(() => {
    if (categories) {
      setLocalCategories(
        categories.map((category) => ({
          id: category.id,
          name: category.name,
          keywords: category.keywords,
        })),
      );
    }
  }, [categories]);

  const updateCategory = (index: number, patch: Partial<CategoryDraft>) => {
    setLocalCategories((current) =>
      current.map((category, i) => (i === index ? { ...category, ...patch } : category)),
    );
  };

  const removeCategory = (index: number) => {
    setLocalCategories((current) => current.filter((_, i) => i !== index));
  };

  const addCategory = () => {
    if (!newCat.name.trim()) return;
    setLocalCategories((current) => [...current, newCat]);
    setNewCat({ name: '', keywords: '' });
  };

  const submit = async () => {
    try {
      const day = Number.parseInt(dueDay, 10);
      await saveSettings.mutateAsync({
        monthlyFeeCents: feeCents,
        dueDay: Number.isFinite(day) ? day : 15,
      });
      const result = await onSaveCategories(localCategories);
      setSaveError(null);
      setReclassifiedMsg(reclassifiedMessage(result.reclassified));
    } catch (error) {
      setReclassifiedMsg(null);
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar.');
    }
  };

  return (
    <Screen>
      <div
        style={{
          background: 'var(--petrol-800)',
          color: '#fff',
          padding: '18px 18px 20px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'rgba(255,255,255,.12)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            border: 'none',
            flex: 'none',
          }}
        >
          <Icon name="chevronLeft" color="#fff" />
        </button>
        <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600 }}>
          Ajustes
        </div>
      </div>
      <ScreenBody>
        {(settings.isError || categoriesError) && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar as configurações.</p>
        )}
        {settings.isLoading && <SettingsSkeleton />}
        {settings.isSuccess && (
          <div style={{ paddingTop: 2 }}>
            <MoneyInput label="Valor da taxa" value={feeCents} onChange={setFeeCents} />
            <Field label="Dia de vencimento" value={dueDay} onChange={setDueDay} type="number" />
          </div>
        )}

        <SectionLabel>Categorias de contas</SectionLabel>
        {localCategories.map((category, index) => (
          <SurfaceCard
            key={category.id ?? `new-${index}`}
            style={{ padding: 12, marginBottom: 10 }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Field
                  label="Nome"
                  value={category.name}
                  onChange={(value) => updateCategory(index, { name: value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Field
                  label="Palavras-chave"
                  value={category.keywords}
                  onChange={(value) => updateCategory(index, { keywords: value })}
                />
              </div>
              <button
                type="button"
                aria-label={`Remover categoria ${category.name}`}
                onClick={() => removeCategory(index)}
                style={{
                  width: 38,
                  height: 38,
                  marginBottom: 16,
                  borderRadius: 10,
                  background: 'var(--atraso-bg)',
                  border: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flex: 'none',
                }}
              >
                <Icon name="x" size={16} color="var(--atraso-700)" />
              </button>
            </div>
          </SurfaceCard>
        ))}

        <SurfaceCard style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 10 }}>Nova categoria</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Nome da nova categoria"
                value={newCat.name}
                onChange={(value) => setNewCat({ ...newCat, name: value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Palavras-chave da nova categoria"
                value={newCat.keywords}
                onChange={(value) => setNewCat({ ...newCat, keywords: value })}
              />
            </div>
          </div>
          <PrimaryButton icon="plus" onClick={addCategory}>
            Adicionar categoria
          </PrimaryButton>
        </SurfaceCard>

        {reclassifiedMsg && (
          <div
            role="status"
            style={{
              background: 'var(--pago-bg)',
              border: '1px solid var(--pago-line)',
              color: 'var(--pago-700)',
              borderRadius: 'var(--r-md)',
              padding: '12px 14px',
              marginBottom: 16,
              fontWeight: 600,
              fontSize: '.9rem',
            }}
          >
            {reclassifiedMsg}
          </div>
        )}

        {saveError && (
          <div
            role="alert"
            style={{
              background: 'var(--atraso-bg)',
              border: '1px solid var(--atraso-line)',
              color: 'var(--atraso-700)',
              borderRadius: 'var(--r-md)',
              padding: '12px 14px',
              marginBottom: 16,
              fontWeight: 600,
              fontSize: '.9rem',
            }}
          >
            {saveError}
          </div>
        )}

        <PrimaryButton
          icon="check"
          onClick={() => void submit()}
          disabled={
            !settings.isSuccess || !categoriesReady || saveSettings.isPending || savingCategories
          }
        >
          Salvar e reclassificar contas
        </PrimaryButton>
      </ScreenBody>
    </Screen>
  );
}
