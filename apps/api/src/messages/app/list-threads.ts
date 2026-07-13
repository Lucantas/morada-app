import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export async function listThreads(repo: ThreadRepository): Promise<Thread[]> {
  return [...(await repo.list())].sort((a, b) =>
    a.residentName.localeCompare(b.residentName, 'pt-BR'),
  );
}
