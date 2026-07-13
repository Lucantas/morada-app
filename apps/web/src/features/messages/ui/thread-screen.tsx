import { useEffect, useRef } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';

import type { ThreadRepository } from '../domain/thread-repository';

import { ChatThread } from './chat-thread';
import { MessageComposer } from './message-composer';
import { useMarkRead, usePostMessage, useThread } from './use-threads';

type Props = {
  repository: ThreadRepository;
  threadId: string;
  onBack: () => void;
};

export function ThreadScreen({ repository, threadId, onBack }: Props) {
  const thread = useThread(repository, threadId);
  const post = usePostMessage(repository);
  const markRead = useMarkRead(repository);
  const markReadMutate = markRead.mutate;
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markReadMutate(threadId);
  }, [markReadMutate, threadId]);

  const title = thread.data?.residentName ?? 'Conversa';

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
            Mensagens · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            {title}
          </div>
        </div>
      </div>
      <ScreenBody>
        {thread.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando conversa…</p>}
        {thread.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar a conversa.</p>
        )}
        {thread.isSuccess && <ChatThread messages={thread.data.messages} ownSide="admin" />}
      </ScreenBody>
      <MessageComposer
        onSend={(text, clear) =>
          post.mutate({ threadId, author: 'admin', text }, { onSuccess: clear })
        }
      />
    </Screen>
  );
}
