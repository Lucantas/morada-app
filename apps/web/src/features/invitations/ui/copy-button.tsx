import { useEffect, useRef, useState } from 'react';

import { copyText } from '@/shared/lib/clipboard';

const COPIED_FEEDBACK_MS = 2000;
const COPY_FAILED = 'Não foi possível copiar';

type Props = { value: string; label: string; copiedLabel: string; ariaLabel?: string };

export function CopyButton({ value, label, copiedLabel, ariaLabel }: Props) {
  const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = async () => {
    const next = await copyText(value).then(
      () => 'copied' as const,
      () => 'failed' as const,
    );
    setFeedback(next);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setFeedback(null), COPIED_FEEDBACK_MS);
  };

  const text = feedback === 'copied' ? copiedLabel : feedback === 'failed' ? COPY_FAILED : label;

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={feedback === null ? ariaLabel : undefined}
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
      {text}
    </button>
  );
}
