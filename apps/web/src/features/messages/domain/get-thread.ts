import { ThreadNotFoundError } from './errors';
import type { Thread } from './message';
import type { ThreadRepository } from './thread-repository';

export async function getThread(repository: ThreadRepository, id: string): Promise<Thread> {
  const thread = await repository.getById(id);
  if (!thread) throw new ThreadNotFoundError(id);
  return thread;
}
