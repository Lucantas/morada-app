import { ThreadNotFoundError } from '../domain/errors';
import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export function markRead(repo: ThreadRepository, id: string): Thread {
  const thread = repo.getById(id);
  if (!thread) throw new ThreadNotFoundError(id);
  return repo.save({ ...thread, unread: false });
}
