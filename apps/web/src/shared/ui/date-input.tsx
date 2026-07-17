import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Icon } from './icon';

type Props = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
};

export function maskDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

export function isoToBr(iso: string): string {
  if (iso === '') return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

export function brToIso(input: string): string {
  const masked = maskDate(input);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!match) return '';
  const [, dayStr, monthStr, yearStr] = match;
  if (!dayStr || !monthStr || !yearStr) return '';
  const day = Number.parseInt(dayStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const year = Number.parseInt(yearStr, 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate) return '';
  return `${yearStr}-${monthStr}-${dayStr}`;
}

export function DateInput({ label, value, onChange, placeholder }: Props) {
  const [text, setText] = useState(() => isoToBr(value));
  const nativeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (brToIso(text) !== value) setText(isoToBr(value));
  }, [value, text]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const masked = maskDate(event.target.value);
    setText(masked);
    onChange(brToIso(masked));
  };

  const handleNativeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const iso = event.target.value;
    setText(isoToBr(iso));
    onChange(iso);
  };

  const openPicker = () => {
    const el = nativeInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
    }
  };

  return (
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
        {label}
      </span>
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
        <input
          type="text"
          inputMode="numeric"
          maxLength={10}
          aria-label={label}
          value={text}
          placeholder={placeholder ?? 'dd/mm/aaaa'}
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
          }}
        />
        <button
          type="button"
          aria-label={`Escolher data — ${label}`}
          onClick={openPicker}
          style={{
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            background: 'transparent',
            color: 'var(--ink-500)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Icon name="calendar" size={19} />
        </button>
        <input
          ref={nativeInputRef}
          type="date"
          value={value}
          onChange={handleNativeChange}
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      </div>
    </label>
  );
}
