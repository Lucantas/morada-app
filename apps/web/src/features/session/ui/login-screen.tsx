import { useState, type CSSProperties } from 'react';

import { Icon } from '@/shared/ui/icon';

type Props = {
  onSubmit: (username: string, password: string) => void;
  error?: string | null;
  pending?: boolean;
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 50,
  borderRadius: 12,
  border: '1.5px solid rgba(255,255,255,.22)',
  background: 'rgba(255,255,255,.08)',
  color: '#fff',
  padding: '0 14px',
  fontFamily: "'Inter', sans-serif",
  fontSize: '1rem',
  outline: 'none',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '.72rem',
  color: '#9FC0C3',
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  fontWeight: 600,
  margin: '0 0 6px 2px',
};

export function LoginScreen({ onSubmit, error, pending }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    const u = username.trim();
    if (!u || !password) return;
    onSubmit(u, password);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
        <div>
          <label htmlFor="login-username" style={labelStyle}>
            Usuário
          </label>
          <input
            id="login-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="login-password" style={labelStyle}>
            Senha
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && (
          <p role="alert" style={{ color: '#F4B9A8', fontSize: '.9rem', margin: '2px 2px 0' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
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
            cursor: pending ? 'default' : 'pointer',
            opacity: pending ? 0.7 : 1,
            boxShadow: 'var(--sh-2)',
            marginTop: 4,
          }}
        >
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  );
}
