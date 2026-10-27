import { useState } from 'react';

import { Field, PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';

import type { NewApartment } from '../domain/building-repository';

type Props = {
  blocks: readonly string[];
  isPending: boolean;
  onSubmit: (input: NewApartment) => void;
  onCancel: () => void;
};

const NO_BLOCK = '';

function floorFrom(text: string): number | null {
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AddApartmentForm({ blocks, isPending, onSubmit, onCancel }: Props) {
  const [label, setLabel] = useState('');
  const [block, setBlock] = useState(NO_BLOCK);
  const [floor, setFloor] = useState('');

  const submit = () => {
    const trimmed = label.trim();
    if (trimmed === '') return;
    onSubmit({ label: trimmed, block: block === NO_BLOCK ? null : block, floor: floorFrom(floor) });
  };

  return (
    <SurfaceCard style={{ padding: 14, marginBottom: 16 }}>
      <Field label="Nome do apartamento" value={label} onChange={setLabel} />
      {blocks.length > 0 && (
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '.9rem', marginBottom: 7 }}>
            Bloco
          </span>
          <select
            value={block}
            onChange={(event) => setBlock(event.target.value)}
            style={{
              width: '100%',
              minHeight: 50,
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-md)',
              padding: '0 12px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '1rem',
              background: 'var(--surface)',
            }}
          >
            <option value={NO_BLOCK}>Sem bloco</option>
            {blocks.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Field label="Andar" value={floor} onChange={setFloor} type="number" />
      <PrimaryButton icon="check" onClick={submit} disabled={isPending}>
        Adicionar
      </PrimaryButton>
      <button
        type="button"
        onClick={onCancel}
        style={{
          width: '100%',
          minHeight: 44,
          marginTop: 8,
          border: 'none',
          background: 'transparent',
          color: 'var(--ink-500)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Cancelar
      </button>
    </SurfaceCard>
  );
}
