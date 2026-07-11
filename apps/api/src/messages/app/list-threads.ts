import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

export function listThreads(repo: ThreadRepository): Thread[] {
  return [...repo.list()].sort((a, b) => a.residentName.localeCompare(b.residentName, 'pt-BR'));
}
