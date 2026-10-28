import { ThreadNotFoundError } from '../domain/errors';
import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export async function markRead(
  repo: ThreadRepository,
  id: string,
  viewerUserId: string,
): Promise<Thread> {
  if (!(await repo.getById(id, viewerUserId))) throw new ThreadNotFoundError(id);
  await repo.markRead(id, viewerUserId);
  const refreshed = await repo.getById(id, viewerUserId);
  if (!refreshed) throw new ThreadNotFoundError(id);
  return refreshed;
}
