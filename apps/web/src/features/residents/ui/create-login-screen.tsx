import { useState } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/phone-frame';
import { Field, PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';

type ProvisionResult = { username: string; tempPassword: string };

type Props = {
  residentId: string;
  residentName?: string;
  provision: (input: { username: string; residentId: string }) => Promise<ProvisionResult>;
  onBack: () => void;
};

export function CreateLoginScreen({ residentId, residentName, provision, onBack }: Props) {
  const [username, setUsername] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ProvisionResult | null>(null);

  const submit = async () => {
    const u = username.trim();
    if (!u || pending) return;
    setPending(true);
    setError(null);
    try {
      setCreated(await provision({ username: u, residentId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o acesso.');
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
        {created ? (
          <SurfaceCard>
            <p style={{ fontWeight: 600, color: 'var(--ink-900)', marginBottom: 12 }}>
              Acesso criado. Anote e repasse ao morador — a senha não será mostrada novamente.
            </p>
            <CredentialRow label="Usuário" value={created.username} />
            <CredentialRow label="Senha temporária" value={created.tempPassword} />
          </SurfaceCard>
        ) : (
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

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderTop: '1px solid var(--line)',
      }}
    >
      <span style={{ color: 'var(--ink-500)', fontSize: '.86rem' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--ink-900)', fontVariantLigatures: 'none' }}>
        {value}
      </span>
    </div>
  );
}
