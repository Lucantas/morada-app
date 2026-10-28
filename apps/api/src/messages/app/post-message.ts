import { randomUUID } from 'node:crypto';

import { EmptyMessageError, ThreadNotFoundError } from '../domain/errors';
import type { Message, Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export async function postMessage(
  repo: ThreadRepository,
  threadId: string,
  author: Message['author'],
  text: string,
  viewerUserId: string,
): Promise<Thread> {
  const thread = await repo.getById(threadId, viewerUserId);
  if (!thread) throw new ThreadNotFoundError(threadId);
  if (text.trim().length === 0) throw new EmptyMessageError();

  const message: Message = { id: randomUUID(), author, text, dateLabel: 'Agora' };
  await repo.save({ ...thread, messages: [...thread.messages, message] });
  if (author === 'resident') await repo.recordResidentMessage(threadId);
  else await repo.markRead(threadId, viewerUserId);

  const refreshed = await repo.getById(threadId, viewerUserId);
  if (!refreshed) throw new ThreadNotFoundError(threadId);
  return refreshed;
}
