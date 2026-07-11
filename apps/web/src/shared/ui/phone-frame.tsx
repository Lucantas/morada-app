import type { ReactNode } from 'react';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--sand)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 390,
          maxWidth: '100%',
          background: 'var(--petrol-900)',
          borderRadius: 44,
          padding: 12,
          boxShadow: 'var(--sh-3)',
        }}
      >
        <div
          style={{
            background: 'var(--sand)',
            borderRadius: 32,
            overflow: 'hidden',
            position: 'relative',
            height: 788,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>{children}</div>;
}

export function ScreenBody({ children }: { children: ReactNode }) {
  return (
    <div className="hide-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px' }}>
      {children}
    </div>
  );
}
