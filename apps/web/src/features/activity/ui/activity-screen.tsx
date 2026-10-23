import { useCondoName } from '@/shared/lib/condo-scope';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { EmptyState } from '@/shared/ui/empty-state';
import { Icon } from '@/shared/ui/icon';
import { SurfaceCard } from '@/shared/ui/primitives';
import { StatusView } from '@/shared/ui/status-view';

import { formatActivityTime, type ActivityEntry } from '../domain/activity';
import type { ActivityRepository } from '../domain/activity-repository';

import { useActivity } from './use-activity';

type Props = {
  repository: ActivityRepository;
  onBack: () => void;
};

export function ActivityScreen({ repository, onBack }: Props) {
  const condoName = useCondoName();
  const activity = useActivity(repository);

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
        <div>
          <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>{condoName}</div>
          <h1 className="fraunces" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600 }}>
            Atividade
          </h1>
        </div>
      </div>
      <ScreenBody>
        {activity.isLoading && <StatusView variant="loading" message="Carregando…" />}
        {activity.isError && (
          <StatusView
            variant="error"
            message="Não foi possível carregar a atividade."
            onRetry={() => void activity.refetch()}
          />
        )}
        {activity.isSuccess && <ActivityList entries={activity.data} />}
      </ScreenBody>
    </Screen>
  );
}

function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon="clock" title="Nenhuma atividade ainda." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map((entry) => (
        <SurfaceCard key={entry.id} style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600 }}>{entry.label}</div>
          <div style={{ fontSize: '.84rem', color: 'var(--ink-500)', marginTop: 2 }}>
            {entry.actorName} · {formatActivityTime(entry.at)}
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}
