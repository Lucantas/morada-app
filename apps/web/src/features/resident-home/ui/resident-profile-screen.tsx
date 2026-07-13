import type { ReactNode } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { TopBar } from '@/shared/ui/top-bar';

import { residentInitials } from './current-resident';

type Props = {
  resident: { name: string; apt: string; phone: string; email: string };
  onSignOut: () => void;
  bottomNav: ReactNode;
};

export function ResidentProfileScreen({ resident, onSignOut, bottomNav }: Props) {
  return (
    <Screen>
      <TopBar eyebrow="Condomínio Morada · Bloco 2" title="Perfil" />
      <ScreenBody>
        <SurfaceCard style={{ padding: '18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                flex: 'none',
                borderRadius: 999,
                background: 'var(--petrol-100)',
                color: 'var(--petrol-800)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: '1.15rem',
              }}
            >
              {residentInitials(resident.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--petrol-900)' }}>
                {resident.name}
              </div>
              <div style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>
                {resident.apt} · Bloco 2
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SectionLabel>Contato</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow label="Telefone" value={resident.phone} />
          <InfoRow label="E-mail" value={resident.email} />
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={onSignOut}
            style={{
              width: '100%',
              minHeight: 50,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface)',
              color: 'var(--ink-900)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            <Icon name="logout" size={19} color="var(--ink-900)" />
            Sair
          </button>
        </div>
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <SurfaceCard
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px 14px',
      }}
    >
      <span style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--petrol-900)' }}>
        {value}
      </span>
    </SurfaceCard>
  );
}
