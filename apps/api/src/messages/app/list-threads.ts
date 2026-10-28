import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export async function listThreads(repo: ThreadRepository, viewerUserId: string): Promise<Thread[]> {
  return [...(await repo.list(viewerUserId))].sort((a, b) =>
    a.residentName.localeCompare(b.residentName, 'pt-BR'),
  );
}
