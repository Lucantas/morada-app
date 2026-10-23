import type { ReactNode } from 'react';

import { useCondoName } from '@/shared/lib/condo-scope';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { TopBar } from '@/shared/ui/top-bar';

import type { ThreadRepository } from '../domain/thread-repository';

import { ChatThread } from './chat-thread';
import { MessageComposer } from './message-composer';
import { usePostMessage, useThread } from './use-threads';

type Props = {
  repository: ThreadRepository;
  threadId: string;
  bottomNav: ReactNode;
};

export function SupportScreen({ repository, threadId, bottomNav }: Props) {
  const condoName = useCondoName();
  const thread = useThread(repository, threadId);
  const post = usePostMessage(repository);

  return (
    <Screen>
      <TopBar eyebrow={condoName} title="Falar com o síndico" />
      <ScreenBody>
        {thread.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando conversa…</p>}
        {thread.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar a conversa.</p>
        )}
        {thread.isSuccess && <ChatThread messages={thread.data.messages} ownSide="resident" />}
      </ScreenBody>
      <MessageComposer
        onSend={(text, clear) =>
          post.mutate({ threadId, author: 'resident', text }, { onSuccess: clear })
        }
      />
      {bottomNav}
    </Screen>
  );
}
