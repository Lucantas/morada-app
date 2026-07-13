import type { ReactNode } from 'react';

/**
 * Responsive, mobile-first app shell. On phones it fills the viewport; on wider
 * screens the content settles into a centered column (see `.app-shell` /
 * `.app-viewport` in tokens.css). No device chrome — this is a real web page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="app-viewport">{children}</div>
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
