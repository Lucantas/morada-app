import type { ReactNode } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { PrimaryButton, SectionLabel, StatCard, SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';
import { TopBar } from '@/shared/ui/top-bar';

import { initials, type Resident } from '../domain/resident';
import { residentStats } from '../domain/resident-stats';
import type { ResidentRepository } from '../domain/resident-repository';

import { residentStatusView } from './resident-status-view';
import { useResidents } from './use-residents';

type Props = {
  repository: ResidentRepository;
  onOpenResident: (id?: string) => void;
  bottomNav: ReactNode;
};

export function ResidentsScreen({ repository, onOpenResident, bottomNav }: Props) {
  const residents = useResidents(repository);

  return (
    <Screen>
      <TopBar eyebrow="Condomínio Morada · Bloco 2" title="Moradores">
        <div style={{ position: 'relative', marginTop: 14 }}>
          <Icon
            name="search"
            size={18}
            color="#7FA6AA"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            placeholder="Buscar morador ou apartamento"
            style={{
              width: '100%',
              minHeight: 46,
              border: 'none',
              borderRadius: 12,
              padding: '0 14px 0 40px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '.95rem',
              color: '#fff',
              background: 'rgba(255,255,255,.10)',
            }}
          />
        </div>
      </TopBar>
      <ScreenBody>
        {residents.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando moradores…</p>}
        {residents.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar os moradores.</p>
        )}
        {residents.isSuccess && (
          <ResidentsContent residents={residents.data} onOpenResident={onOpenResident} />
        )}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function ResidentsContent({
  residents,
  onOpenResident,
}: {
  residents: Resident[];
  onOpenResident: (id?: string) => void;
}) {
  const stats = residentStats(residents);
  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
        <StatCard value={stats.total} label="Moradores" />
        <StatCard value={stats.emDia} label="Em dia" valueColor="var(--pago-700)" />
        <StatCard value={stats.pendencias} label="Pendências" valueColor="var(--atraso-700)" />
      </div>
      <div style={{ marginTop: 12 }}>
        <PrimaryButton icon="userPlus" onClick={() => onOpenResident()}>
          Cadastrar morador
        </PrimaryButton>
      </div>
      <SectionLabel>Lista de moradores</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {residents.map((resident) => (
          <ResidentRow
            key={resident.id}
            resident={resident}
            onClick={() => onOpenResident(resident.id)}
          />
        ))}
      </div>
    </>
  );
}

function ResidentRow({ resident, onClick }: { resident: Resident; onClick: () => void }) {
  const view = residentStatusView(resident.status);
  return (
    <SurfaceCard
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px' }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flex: 'none',
          borderRadius: 999,
          background: 'var(--petrol-100)',
          color: 'var(--petrol-800)',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: '1rem',
        }}
      >
        {initials(resident.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{resident.name}</div>
        <div style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>{resident.apt} · Bloco 2</div>
      </div>
      <StatusPill tone={view.tone} label={view.label} />
      <Icon name="chevronRight" size={18} color="var(--ink-300)" style={{ flex: 'none' }} />
    </SurfaceCard>
  );
}
