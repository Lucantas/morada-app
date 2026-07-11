import type { Thread } from './message';
import type { ThreadRepository } from './thread-repository';

export async function listThreads(repository: ThreadRepository): Promise<Thread[]> {
  return repository.list();
}
