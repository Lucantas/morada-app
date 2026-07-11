import { Icon } from '@/shared/ui/icon';

import type { Role } from '../domain/session';

export function LoginScreen({ onEnter }: { onEnter: (role: Role) => void }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'center',
        padding: '52px 34px 40px',
        background:
          'radial-gradient(120% 120% at 82% -8%, rgba(183,141,62,.20), transparent 55%), linear-gradient(160deg,var(--petrol-800),var(--petrol-900))',
        color: '#EAF2F2',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: 'var(--brass-500)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--petrol-900)',
            boxShadow: 'var(--sh-2)',
          }}
        >
          <Icon name="bank" size={32} color="currentColor" />
        </div>
        <h1
          className="fraunces"
          style={{
            color: '#fff',
            fontSize: '3.6rem',
            fontWeight: 600,
            letterSpacing: '-.5px',
            marginTop: 28,
          }}
        >
          Morada
        </h1>
        <p style={{ color: '#C9DCDD', fontSize: '1.2rem', marginTop: 8 }}>Bloco 2</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p
          style={{
            fontSize: '.82rem',
            color: '#9FC0C3',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Entrar como
        </p>
        <button
          onClick={() => onEnter('admin')}
          style={{
            width: '100%',
            minHeight: 54,
            border: 'none',
            borderRadius: 14,
            background: '#fff',
            color: 'var(--petrol-800)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '1.05rem',
            cursor: 'pointer',
            boxShadow: 'var(--sh-2)',
          }}
        >
          Administrador
        </button>
        <button
          onClick={() => onEnter('resident')}
          style={{
            width: '100%',
            minHeight: 54,
            borderRadius: 14,
            background: 'transparent',
            color: '#fff',
            border: '1.5px solid rgba(255,255,255,.4)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '1.05rem',
            cursor: 'pointer',
          }}
        >
          Morador
        </button>
      </div>
    </div>
  );
}
