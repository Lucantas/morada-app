import { useState } from 'react';

import { SurfaceCard } from '@/shared/ui/primitives';

import type { BuildingApartment } from '../domain/building';

type Props = {
  apartment: BuildingApartment;
  isPending: boolean;
  onRename: (label: string) => void;
  onDeactivate: () => void;
};

const linkButton = {
  minHeight: 40,
  padding: '0 10px',
  border: 'none',
  background: 'transparent',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '.88rem',
  cursor: 'pointer',
} as const;

export function ApartmentStructureRow({ apartment, isPending, onRename, onDeactivate }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(apartment.label);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed === '') return;
    setEditing(false);
    if (trimmed !== apartment.label) onRename(trimmed);
  };

  return (
    <SurfaceCard style={{ padding: '8px 12px', marginBottom: 8 }}>
      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            aria-label="Novo nome"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            style={{
              flex: 1,
              minHeight: 44,
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-md)',
              padding: '0 12px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '1rem',
            }}
          />
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            style={{ ...linkButton, color: 'var(--petrol-600)' }}
          >
            Salvar nome
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{apartment.label}</div>
            {apartment.residentName && (
              <div style={{ fontSize: '.82rem', color: 'var(--ink-500)' }}>
                {apartment.residentName}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={`Renomear ${apartment.label}`}
            onClick={() => {
              setDraft(apartment.label);
              setEditing(true);
            }}
            style={{ ...linkButton, color: 'var(--petrol-600)' }}
          >
            Renomear
          </button>
          <button
            type="button"
            aria-label={`Desativar ${apartment.label}`}
            onClick={onDeactivate}
            style={{ ...linkButton, color: 'var(--atraso-700)' }}
          >
            Desativar
          </button>
        </div>
      )}
    </SurfaceCard>
  );
}
