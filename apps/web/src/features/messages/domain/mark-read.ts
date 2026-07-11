import type { Thread } from './message';
import type { ThreadRepository } from './thread-repository';

export async function markRead(repository: ThreadRepository, threadId: string): Promise<Thread> {
  return repository.markRead(threadId);
}
