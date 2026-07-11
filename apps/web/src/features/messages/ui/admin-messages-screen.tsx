import type { ReactNode } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/phone-frame';
import { SurfaceCard } from '@/shared/ui/primitives';
import { TopBar } from '@/shared/ui/top-bar';

import type { Message, Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

import { useThreads } from './use-threads';

type Props = {
  repository: ThreadRepository;
  onOpenThread: (id: string) => void;
  bottomNav: ReactNode;
};

export function AdminMessagesScreen({ repository, onOpenThread, bottomNav }: Props) {
  const threads = useThreads(repository);

  return (
    <Screen>
      <TopBar eyebrow="Condomínio Morada · Bloco 2" title="Mensagens" />
      <ScreenBody>
        {threads.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando conversas…</p>}
        {threads.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar as conversas.</p>
        )}
        {threads.isSuccess && threads.data.length === 0 && (
          <p style={{ color: 'var(--ink-500)' }}>Nenhuma conversa por aqui ainda.</p>
        )}
        {threads.isSuccess && threads.data.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {threads.data.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} onClick={() => onOpenThread(thread.id)} />
            ))}
          </div>
        )}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function lastText(messages: Message[]): string {
  const last = messages[messages.length - 1];
  return last?.text ?? '';
}

function ThreadRow({ thread, onClick }: { thread: Thread; onClick: () => void }) {
  return (
    <SurfaceCard
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px' }}
    >
      {thread.unread && (
        <span
          aria-label="Não lida"
          style={{
            width: 9,
            height: 9,
            flex: 'none',
            borderRadius: 999,
            background: 'var(--atraso-700)',
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{thread.residentName}</div>
        <div style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>{thread.apt} · Bloco 2</div>
        <div
          style={{
            fontSize: '.88rem',
            color: 'var(--ink-700)',
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lastText(thread.messages)}
        </div>
      </div>
      <Icon name="chevronRight" size={18} color="var(--ink-300)" style={{ flex: 'none' }} />
    </SurfaceCard>
  );
}
