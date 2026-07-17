import { useId, useLayoutEffect, useRef, type ChangeEvent } from 'react';

import { formatBRL } from '@/shared/lib/money';

type Props = {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  placeholder?: string;
};

export function MoneyInput({ label, value, onChange, placeholder }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value === 0 ? '' : formatBRL(value);

  const caretToEnd = () => {
    const el = inputRef.current;
    if (!el) return;
    const end = el.value.length;
    el.setSelectionRange(end, end);
  };

  useLayoutEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) caretToEnd();
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '');
    onChange(digits === '' ? 0 : Number.parseInt(digits, 10));
  };

  return (
    <div style={{ display: 'block', marginBottom: 16 }}>
      <label
        htmlFor={inputId}
        style={{
          display: 'block',
          fontWeight: 600,
          fontSize: '.9rem',
          marginBottom: 7,
          color: 'var(--ink-900)',
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 50,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '0 15px',
          background: 'var(--surface)',
        }}
      >
        <span style={{ color: 'var(--ink-500)', fontSize: '1rem', fontWeight: 600 }}>R$</span>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={display}
          placeholder={placeholder ?? '0,00'}
          onChange={handleChange}
          onFocus={() => requestAnimationFrame(caretToEnd)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: "'Inter', sans-serif",
            fontSize: '1rem',
            color: 'var(--ink-900)',
            textAlign: 'right',
          }}
        />
      </div>
    </div>
  );
}
