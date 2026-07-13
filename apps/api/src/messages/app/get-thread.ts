import { ThreadNotFoundError } from '../domain/errors';
import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export async function getThread(repo: ThreadRepository, id: string): Promise<Thread> {
  const thread = await repo.getById(id);
  if (!thread) throw new ThreadNotFoundError(id);
  return thread;
}
