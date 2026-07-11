import type { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  title: string;
  right?: ReactNode;
  children?: ReactNode;
};

export function TopBar({ eyebrow, title, right, children }: Props) {
  return (
    <div
      style={{
        background: 'var(--petrol-800)',
        color: '#fff',
        padding: '18px 18px 20px',
        flex: 'none',
      }}
    >
      <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>{eyebrow}</div>
      <div
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: '1.4rem',
          fontWeight: 600,
          color: '#fff',
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <h1 style={{ margin: 0, font: 'inherit', color: 'inherit' }}>{title}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}
