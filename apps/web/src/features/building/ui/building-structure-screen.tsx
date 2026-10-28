import { useState } from 'react';

import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Icon } from '@/shared/ui/icon';
import { SectionLabel } from '@/shared/ui/primitives';
import { StatusView } from '@/shared/ui/status-view';

import type { BuildingApartment } from '../domain/building';
import type { BuildingRepository } from '../domain/building-repository';

import { AddApartmentForm } from './add-apartment-form';
import { ApartmentStructureRow } from './apartment-structure-row';
import { useBuilding } from './use-building';
import { useBuildingMutations } from './use-building-mutations';

type Props = {
  repository: BuildingRepository;
  onBack: () => void;
};

const SINGLE_BLOCK_TITLE = 'Prédio';
const UNPLACED_TITLE = 'Outras unidades';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível salvar.';
}

export function BuildingStructureScreen({ repository, onBack }: Props) {
  const building = useBuilding(repository);
  const { add, rename, deactivate } = useBuildingMutations(repository);
  const [adding, setAdding] = useState(false);
  const [pendingDeactivation, setPendingDeactivation] = useState<BuildingApartment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blockNames = (building.data?.blocks ?? []).flatMap((block) =>
    block.name === null ? [] : [block.name],
  );

  const fail = (cause: unknown) => setError(messageOf(cause));

  const confirmDeactivation = () => {
    if (!pendingDeactivation) return;
    setError(null);
    deactivate.mutate(pendingDeactivation.id, { onError: fail });
    setPendingDeactivation(null);
  };

  const renderRow = (apartment: BuildingApartment) => (
    <ApartmentStructureRow
      key={apartment.id}
      apartment={apartment}
      isPending={rename.isPending}
      onRename={(label) => {
        setError(null);
        rename.mutate({ id: apartment.id, label }, { onError: fail });
      }}
      onDeactivate={() => setPendingDeactivation(apartment)}
    />
  );

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
          type="button"
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
          Estrutura do prédio
        </div>
      </div>
      <ScreenBody>
        {building.isError && (
          <StatusView
            variant="error"
            message="Não foi possível carregar o prédio."
            onRetry={() => void building.refetch()}
          />
        )}
        {building.isPending && <StatusView variant="loading" message="Carregando o prédio…" />}
        {building.isSuccess && (
          <>
            {adding ? (
              <AddApartmentForm
                blocks={blockNames}
                isPending={add.isPending}
                onCancel={() => setAdding(false)}
                onSubmit={(input) => {
                  setError(null);
                  add.mutate(input, { onSuccess: () => setAdding(false), onError: fail });
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  marginBottom: 16,
                  border: '1.5px dashed var(--line)',
                  borderRadius: 'var(--r-md)',
                  background: 'transparent',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  color: 'var(--petrol-600)',
                  cursor: 'pointer',
                }}
              >
                + Apartamento
              </button>
            )}
            {error && (
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
                {error}
              </div>
            )}
            {building.data.blocks.map((block) => (
              <section key={block.name ?? SINGLE_BLOCK_TITLE}>
                <SectionLabel>{block.name ?? SINGLE_BLOCK_TITLE}</SectionLabel>
                {block.floors.map((floor) => (
                  <div key={floor.floor}>
                    <div
                      style={{ fontSize: '.82rem', color: 'var(--ink-500)', margin: '8px 0 6px' }}
                    >
                      {`Andar ${floor.floor}`}
                    </div>
                    {floor.apartments.map(renderRow)}
                  </div>
                ))}
              </section>
            ))}
            {building.data.unplaced.length > 0 && (
              <section>
                <SectionLabel>{UNPLACED_TITLE}</SectionLabel>
                {building.data.unplaced.map(renderRow)}
              </section>
            )}
          </>
        )}
      </ScreenBody>
      <ConfirmDialog
        open={pendingDeactivation !== null}
        title="Desativar apartamento?"
        message={
          pendingDeactivation
            ? `O ${pendingDeactivation.label} sai do desenho do prédio. O histórico é preservado.`
            : undefined
        }
        confirmLabel="Desativar"
        tone="danger"
        onConfirm={confirmDeactivation}
        onCancel={() => setPendingDeactivation(null)}
      />
    </Screen>
  );
}
