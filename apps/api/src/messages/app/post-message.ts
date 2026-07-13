import { randomUUID } from 'node:crypto';

import { EmptyMessageError, ThreadNotFoundError } from '../domain/errors';
import type { Message, Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export async function postMessage(
  repo: ThreadRepository,
  threadId: string,
  author: Message['author'],
  text: string,
): Promise<Thread> {
  const thread = await repo.getById(threadId);
  if (!thread) throw new ThreadNotFoundError(threadId);
  if (text.trim().length === 0) throw new EmptyMessageError();

  const message: Message = { id: randomUUID(), author, text, dateLabel: 'Agora' };
  const updated: Thread = {
    ...thread,
    unread: author === 'resident',
    messages: [...thread.messages, message],
  };
  return repo.save(updated);
}
