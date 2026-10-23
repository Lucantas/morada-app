import { useState, type CSSProperties } from 'react';

import { Icon } from '@/shared/ui/icon';

type Props = {
  onSubmit: (login: string, password: string) => void;
  onSignUp: () => void;
  onForgotPassword: () => void;
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

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '10px 2px',
  minHeight: 44,
  color: '#EAF2F2',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '.95rem',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
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

export function LoginScreen({ onSubmit, onSignUp, onForgotPassword, error, pending }: Props) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    const trimmed = login.trim();
    if (!trimmed || !password) return;
    onSubmit(trimmed, password);
  };

  return (
    <div
      className="hide-scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(120% 120% at 82% -8%, rgba(183,141,62,.20), transparent 55%), linear-gradient(160deg,var(--petrol-800),var(--petrol-900))',
        color: '#EAF2F2',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          margin: 'auto',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 30,
          textAlign: 'center',
          padding: '52px 34px calc(40px + env(safe-area-inset-bottom))',
        }}
      >
        <div
          style={{
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
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
          <div>
            <label htmlFor="login-username" style={labelStyle}>
              E-mail ou usuário
            </label>
            <input
              id="login-username"
              name="login"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
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
              enterKeyHint="go"
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

          <div
            style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
          >
            <button type="button" onClick={onSignUp} style={linkStyle}>
              Criar conta
            </button>
            <button type="button" onClick={onForgotPassword} style={linkStyle}>
              Esqueci a senha
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
