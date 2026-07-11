import { ThreadNotFoundError } from './errors';
import type { Thread } from './message';
import type { ThreadRepository } from './thread-repository';

export async function markRead(repository: ThreadRepository, threadId: string): Promise<Thread> {
  const thread = await repository.getById(threadId);
  if (!thread) throw new ThreadNotFoundError(threadId);
  return repository.save({ ...thread, unread: false });
}
