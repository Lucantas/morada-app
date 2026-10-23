import type { CSSProperties, FormEvent, ReactNode } from 'react';

import { Screen, ScreenBody } from './app-shell';
import { Icon } from './icon';

export function EntryLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Screen>
      <ScreenBody>
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            margin: '0 auto',
            padding: '36px 6px calc(24px + env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--brass-500)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--petrol-900)',
              boxShadow: 'var(--sh-2)',
            }}
          >
            <Icon name="bank" size={26} color="currentColor" />
          </div>
          <h1
            className="fraunces"
            style={{
              fontSize: '1.7rem',
              fontWeight: 600,
              color: 'var(--petrol-900)',
              margin: '22px 0 8px',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {intro && (
            <p style={{ color: 'var(--ink-700)', fontSize: '.98rem', margin: '0 0 22px' }}>
              {intro}
            </p>
          )}
          {children}
        </div>
      </ScreenBody>
    </Screen>
  );
}

export function EntryForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '10px 0',
  minHeight: 44,
  color: 'var(--petrol-600)',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '.95rem',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={linkStyle}>
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        background: 'var(--atraso-bg)',
        border: '1px solid var(--atraso-line)',
        color: 'var(--atraso-700)',
        borderRadius: 'var(--r-md)',
        padding: '10px 12px',
        fontSize: '.92rem',
        margin: '0 0 16px',
      }}
    >
      {message}
    </p>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      style={{
        background: 'var(--pago-bg)',
        border: '1px solid var(--pago-line)',
        color: 'var(--pago-700)',
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        fontSize: '.95rem',
        margin: '0 0 16px',
      }}
    >
      {children}
    </p>
  );
}

export function LinkRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 10,
      }}
    >
      {children}
    </div>
  );
}
