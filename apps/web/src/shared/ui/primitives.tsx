import type { ChangeEvent, CSSProperties, ReactNode } from 'react';

import { Icon, type IconName } from './icon';

export function SurfaceCard({
  children,
  style,
  onClick,
}: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 700,
        fontSize: '.82rem',
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color: 'var(--ink-500)',
        margin: '20px 2px 11px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span>{children}</span>
      {right}
    </div>
  );
}

export function StatCard({
  value,
  label,
  valueColor,
}: {
  value: ReactNode;
  label: string;
  valueColor?: string;
}) {
  return (
    <SurfaceCard style={{ flex: 1, padding: '12px 14px' }}>
      <div
        className="fraunces"
        style={{ fontSize: '1.35rem', fontWeight: 700, color: valueColor ?? 'var(--petrol-900)' }}
      >
        {value}
      </div>
      <div style={{ fontSize: '.74rem', color: 'var(--ink-500)', fontWeight: 500 }}>{label}</div>
    </SurfaceCard>
  );
}

export function PrimaryButton({
  children,
  icon,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  icon?: IconName;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 52,
        border: 'none',
        borderRadius: 'var(--r-md)',
        background: 'var(--brass-500)',
        color: 'var(--petrol-900)',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: '1rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        cursor: 'pointer',
        boxShadow: 'var(--sh-1)',
      }}
    >
      {icon && <Icon name={icon} size={19} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
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
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: 50,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '0 15px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '1rem',
          color: 'var(--ink-900)',
          background: 'var(--surface)',
        }}
      />
    </label>
  );
}

export function IconBadge({
  icon,
  bg = 'var(--petrol-50)',
  color = 'var(--petrol-600)',
}: {
  icon: IconName;
  bg?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        flex: 'none',
        borderRadius: 10,
        background: bg,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Icon name={icon} size={19} color={color} />
    </div>
  );
}
