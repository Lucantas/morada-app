import { useEffect, useRef, useState } from 'react';

import { copyText } from '@/shared/lib/clipboard';

const COPIED_FEEDBACK_MS = 2000;

type Props = { value: string; label: string; copiedLabel: string; ariaLabel?: string };

export function CopyButton({ value, label, copiedLabel, ariaLabel }: Props) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = async () => {
    await copyText(value);
    setCopied(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flex: 'none',
        minHeight: 40,
        padding: '0 12px',
        border: '1.5px solid var(--petrol-100)',
        borderRadius: 'var(--r-sm)',
        background: 'var(--petrol-50)',
        color: 'var(--petrol-800)',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: '.85rem',
        cursor: 'pointer',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      {copied ? copiedLabel : label}
    </button>
  );
}

export function CredentialRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderTop: '1px solid var(--line)',
      }}
    >
      <span style={{ color: 'var(--ink-500)', fontSize: '.86rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          data-testid={testId}
          style={{
            fontWeight: 600,
            color: 'var(--ink-900)',
            fontVariantLigatures: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </span>
        <CopyButton
          value={value}
          label="Copiar"
          copiedLabel="Copiado!"
          ariaLabel={`Copiar ${label}`}
        />
      </div>
    </div>
  );
}
