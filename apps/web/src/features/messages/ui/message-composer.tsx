import { useState, type ChangeEvent } from 'react';

import { Icon } from '@/shared/ui/icon';

type Props = {
  onSend: (text: string, clear: () => void) => void;
};

export function MessageComposer({ onSend }: Props) {
  const [text, setText] = useState('');

  const submit = () => {
    if (text.trim().length === 0) return;
    onSend(text, () => setText(''));
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--line)',
        background: 'var(--surface)',
        flex: 'none',
      }}
    >
      <input
        aria-label="Mensagem"
        value={text}
        placeholder="Escreva uma mensagem…"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 46,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '0 14px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '.95rem',
          color: 'var(--ink-900)',
          background: 'var(--surface)',
        }}
      />
      <button
        type="button"
        onClick={submit}
        style={{
          minHeight: 46,
          border: 'none',
          borderRadius: 'var(--r-md)',
          background: 'var(--brass-500)',
          color: 'var(--petrol-900)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: '.95rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '0 15px',
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        <Icon name="check" size={18} strokeWidth={2.2} />
        Responder
      </button>
    </div>
  );
}
