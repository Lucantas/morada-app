import { Field, SectionLabel } from '@/shared/ui/primitives';

import type { CondoSettings } from '../domain/condo-settings';
import type { PixDraft } from '../domain/pix-draft';
import { PIX_KEY_TYPES, PIX_KEY_TYPE_LABELS, type PixKeyType } from '../domain/pix-settings';

type Props = {
  editable: boolean;
  stored: CondoSettings['pix'];
  draft: PixDraft;
  onChange: (draft: PixDraft) => void;
  onRemove: () => void;
};

function ReadOnlyLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '.82rem', color: 'var(--ink-500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export function PixSection({ editable, stored, draft, onChange, onRemove }: Props) {
  if (!editable) {
    return stored === null ? null : (
      <>
        <SectionLabel>Pix</SectionLabel>
        <ReadOnlyLine label="Chave Pix" value={stored.key} />
        <ReadOnlyLine label="Nome do recebedor" value={stored.receiverName} />
        <ReadOnlyLine label="Cidade" value={stored.city} />
      </>
    );
  }

  return (
    <>
      <SectionLabel>Pix</SectionLabel>
      <label style={{ display: 'block', marginBottom: 16 }}>
        <span
          style={{
            display: 'block',
            fontWeight: 600,
            fontSize: '.9rem',
            marginBottom: 7,
            color: 'var(--ink-900)',
          }}
        >
          Tipo de chave Pix
        </span>
        <select
          value={draft.keyType}
          onChange={(event) => onChange({ ...draft, keyType: event.target.value as PixKeyType })}
          style={{
            width: '100%',
            minHeight: 50,
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-md)',
            padding: '0 14px',
            background: 'var(--surface)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '1rem',
            color: 'var(--ink-900)',
          }}
        >
          {PIX_KEY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PIX_KEY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <Field label="Chave Pix" value={draft.key} onChange={(key) => onChange({ ...draft, key })} />
      <Field
        label="Nome do recebedor"
        value={draft.receiverName}
        onChange={(receiverName) => onChange({ ...draft, receiverName })}
      />
      <Field label="Cidade" value={draft.city} onChange={(city) => onChange({ ...draft, city })} />
      <button
        type="button"
        onClick={onRemove}
        style={{
          minHeight: 44,
          marginBottom: 16,
          padding: '0 16px',
          background: 'var(--atraso-bg)',
          color: 'var(--atraso-700)',
          border: 'none',
          borderRadius: 'var(--r-md)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Remover chave
      </button>
    </>
  );
}
