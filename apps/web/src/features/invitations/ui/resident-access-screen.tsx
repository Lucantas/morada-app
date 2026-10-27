import { useQuery } from '@tanstack/react-query';

import type { ResidentRepository } from '@/features/residents/domain/resident-repository';
import { useCondoName } from '@/shared/lib/condo-scope';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Icon } from '@/shared/ui/icon';
import { StatusView } from '@/shared/ui/status-view';

import type { InvitationRepository } from '../domain/invitation-repository';

import { InvitationPanel, invitationKey } from './invitation-panel';
import { LegacyLoginCard } from './legacy-login-card';
import { ResidentAccessSkeleton } from './resident-access-skeleton';

type Props = {
  residentId: string;
  repository: InvitationRepository;
  residents: Pick<ResidentRepository, 'getById'>;
  onBack: () => void;
};

export function ResidentAccessScreen({ residentId, repository, residents, onBack }: Props) {
  const condoName = useCondoName();
  const resident = useQuery({
    queryKey: ['residents', 'detail', residentId],
    queryFn: () => residents.getById(residentId),
  });
  const invitation = useQuery({
    queryKey: invitationKey(residentId),
    queryFn: () => repository.invitation(residentId),
  });

  const loading = resident.isPending || invitation.isPending;
  const failed = resident.isError || invitation.isError;

  return (
    <Screen>
      <AccessHeader condoName={condoName} residentName={resident.data?.name} onBack={onBack} />
      <ScreenBody>
        {loading && !failed && <ResidentAccessSkeleton />}
        {failed && <StatusView variant="error" message="Não foi possível carregar o acesso." />}
        {!loading && !failed && (
          <>
            <InvitationPanel
              residentId={residentId}
              residentEmail={resident.data?.email ?? ''}
              view={invitation.data ?? null}
              repository={repository}
            />
            {invitation.data?.status !== 'aceito' && (
              <LegacyLoginCard residentId={residentId} repository={repository} />
            )}
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}

function AccessHeader({
  condoName,
  residentName,
  onBack,
}: {
  condoName: string;
  residentName?: string;
  onBack: () => void;
}) {
  return (
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
          {`Acesso do morador · ${condoName}`}
        </div>
        <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
          {residentName ?? 'Acesso do morador'}
        </div>
      </div>
    </div>
  );
}
