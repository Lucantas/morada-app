import { ThreadNotFoundError } from '../domain/errors';
import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export function getThread(repo: ThreadRepository, id: string): Thread {
  const thread = repo.getById(id);
  if (!thread) throw new ThreadNotFoundError(id);
  return thread;
}
