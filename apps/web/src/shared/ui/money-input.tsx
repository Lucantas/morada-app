import { useId, type ChangeEvent } from 'react';

import { formatBRL } from '@/shared/lib/money';

type Props = {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  placeholder?: string;
};

export function MoneyInput({ label, value, onChange, placeholder }: Props) {
  const inputId = useId();

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
          type="text"
          inputMode="numeric"
          value={formatBRL(value)}
          placeholder={placeholder}
          onChange={handleChange}
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
