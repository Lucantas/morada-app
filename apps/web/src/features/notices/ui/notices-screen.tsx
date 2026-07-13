import type { ReactNode } from 'react';

import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';
import { TopBar } from '@/shared/ui/top-bar';

import { activeNotices } from '../domain/active-notices';
import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { noticeKindView } from './notice-kind-view';
import { useClearNotices, useDismissNotice, useNotices } from './use-notices';

type Props = {
  repository: NoticeRepository;
  bottomNav: ReactNode;
};

export function NoticesScreen({ repository, bottomNav }: Props) {
  const notices = useNotices(repository);
  const dismiss = useDismissNotice(repository);
  const clear = useClearNotices(repository);

  return (
    <Screen>
      <TopBar eyebrow="Condomínio Morada · Bloco 2" title="Avisos" />
      <ScreenBody>
        {notices.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando avisos…</p>}
        {notices.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar os avisos.</p>
        )}
        {notices.isSuccess && (
          <NoticesContent
            notices={notices.data}
            onDismiss={(id) => dismiss.mutate(id)}
            onClear={() => clear.mutate()}
          />
        )}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function NoticesContent({
  notices,
  onDismiss,
  onClear,
}: {
  notices: Notice[];
  onDismiss: (id: string) => void;
  onClear: () => void;
}) {
  const active = activeNotices(notices);

  if (active.length === 0) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: 240,
          color: 'var(--ink-500)',
          fontSize: '.95rem',
        }}
      >
        Nenhum aviso no momento.
      </div>
    );
  }

  return (
    <>
      {active.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            type="button"
            onClick={onClear}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              color: 'var(--petrol-800)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '.86rem',
              cursor: 'pointer',
            }}
          >
            Limpar todos
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {active.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} onDismiss={() => onDismiss(notice.id)} />
        ))}
      </div>
    </>
  );
}

function NoticeCard({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const view = noticeKindView(notice.kind);
  return (
    <SurfaceCard style={{ padding: '13px 14px' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
      >
        <div style={{ fontWeight: 600, fontSize: '1rem', minWidth: 0 }}>{notice.title}</div>
        <StatusPill tone={view.tone} label={view.label} size="sm" />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '.9rem', color: 'var(--ink-900)' }}>{notice.body}</p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 12,
        }}
      >
        <span style={{ fontSize: '.8rem', color: 'var(--ink-500)' }}>{notice.dateLabel}</span>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            color: 'var(--petrol-800)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.86rem',
            cursor: 'pointer',
          }}
        >
          Dispensar
        </button>
      </div>
    </SurfaceCard>
  );
}
