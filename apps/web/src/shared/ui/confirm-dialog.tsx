import { useEffect, useRef } from 'react';

import { Icon } from './icon';

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'default',
  isPending = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const danger = tone === 'danger';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(15,46,52,.45)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-3)',
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: message ? 8 : 16,
          }}
        >
          <h2
            id="confirm-dialog-title"
            className="fraunces"
            style={{
              flex: 1,
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: 600,
              color: 'var(--ink-900)',
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            style={{
              width: 30,
              height: 30,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              background: 'transparent',
              color: 'var(--ink-500)',
              cursor: 'pointer',
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {message && (
          <p
            style={{
              margin: '0 0 18px',
              color: 'var(--ink-500)',
              fontSize: '.92rem',
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: 'var(--r-md)',
              border: '1.5px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink-700)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '.95rem',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            style={{
              flex: 1,
              minHeight: 46,
              border: 'none',
              borderRadius: 'var(--r-md)',
              background: danger ? 'var(--atraso-700)' : 'var(--brass-500)',
              color: danger ? 'var(--on-danger)' : 'var(--petrol-900)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '.95rem',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
