import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';
import { copyText } from '@/shared/lib/clipboard';

type ProvisionResult = { username: string; tempPassword: string };

type Phase = 'loading' | 'form' | 'existing' | 'done';

type Props = {
  residentId: string;
  residentName?: string;
  provision: (input: { username: string; residentId: string }) => Promise<ProvisionResult>;
  fetchLogin: (residentId: string) => Promise<{ username: string } | null>;
  reset: (residentId: string) => Promise<ProvisionResult>;
  onBack: () => void;
};

export function CreateLoginScreen({
  residentId,
  residentName,
  provision,
  fetchLogin,
  reset,
  onBack,
}: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [existingUsername, setExistingUsername] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ProvisionResult | null>(null);

  useEffect(() => {
    let active = true;
    fetchLogin(residentId)
      .then((login) => {
        if (!active) return;
        if (login) {
          setExistingUsername(login.username);
          setPhase('existing');
        } else {
          setPhase('form');
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Não foi possível consultar o acesso.');
        setPhase('form');
      });
    return () => {
      active = false;
    };
  }, [fetchLogin, residentId]);

  const submit = async () => {
    const u = username.trim();
    if (!u || pending) return;
    setPending(true);
    setError(null);
    try {
      setCredentials(await provision({ username: u, residentId }));
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o acesso.');
    } finally {
      setPending(false);
    }
  };

  const resetPassword = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      setCredentials(await reset(residentId));
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <div
        style={{
          background: 'var(--petrol-800)',
          color: '#fff',
          padding: '18px 18px 20px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'rgba(255,255,255,.12)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            border: 'none',
            flex: 'none',
          }}
        >
          <Icon name="chevronLeft" color="#fff" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>
            Acesso do morador · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            {residentName ?? 'Criar acesso'}
          </div>
        </div>
      </div>
      <ScreenBody>
        {phase === 'loading' && (
          <p style={{ color: 'var(--ink-500)', fontSize: '.92rem', paddingTop: 2 }}>Carregando…</p>
        )}

        {phase === 'done' && credentials && (
          <SurfaceCard>
            <p style={{ fontWeight: 600, color: 'var(--ink-900)', marginBottom: 12 }}>
              Anote e repasse ao morador — a senha não será mostrada novamente.
            </p>
            <CredentialRow label="Usuário" value={credentials.username} testId="login-username" />
            <CredentialRow
              label="Senha temporária"
              value={credentials.tempPassword}
              testId="temp-password"
            />
          </SurfaceCard>
        )}

        {phase === 'existing' && existingUsername && (
          <div style={{ paddingTop: 2 }}>
            <p style={{ color: 'var(--ink-500)', fontSize: '.92rem', marginBottom: 16 }}>
              Este morador já tem acesso. Redefina a senha para gerar uma nova senha temporária.
            </p>
            <SurfaceCard>
              <CredentialRow label="Usuário" value={existingUsername} testId="login-username" />
            </SurfaceCard>
            {error && (
              <p role="alert" style={{ color: 'var(--atraso-700)', margin: '14px 0' }}>
                {error}
              </p>
            )}
            <PrimaryButton icon="check" onClick={() => void resetPassword()}>
              {pending ? 'Redefinindo…' : 'Redefinir senha'}
            </PrimaryButton>
          </div>
        )}

        {phase === 'form' && (
          <div style={{ paddingTop: 2 }}>
            <p style={{ color: 'var(--ink-500)', fontSize: '.92rem', marginBottom: 16 }}>
              Escolha um nome de usuário. O sistema gera uma senha temporária que você entrega ao
              morador.
            </p>
            <Field
              label="Usuário"
              value={username}
              onChange={setUsername}
              placeholder="Ex.: maria302"
            />
            {error && (
              <p role="alert" style={{ color: 'var(--atraso-700)', marginBottom: 14 }}>
                {error}
              </p>
            )}
            <PrimaryButton icon="check" onClick={() => void submit()}>
              {pending ? 'Criando…' : 'Criar acesso'}
            </PrimaryButton>
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}

function CredentialRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = async () => {
    await copyText(value);
    setCopied(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderTop: '1px solid var(--line)',
      }}
    >
      <span style={{ color: 'var(--ink-500)', fontSize: '.86rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          data-testid={testId}
          style={{
            fontWeight: 600,
            color: 'var(--ink-900)',
            fontVariantLigatures: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`Copiar ${label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            flex: 'none',
            minHeight: 32,
            padding: '0 10px',
            border: '1.5px solid var(--petrol-100)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--petrol-50)',
            color: 'var(--petrol-800)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.78rem',
            cursor: 'pointer',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
