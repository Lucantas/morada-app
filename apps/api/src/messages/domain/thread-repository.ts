import type { Thread } from './message';

export interface ThreadRepository {
  list(): Thread[];
  getById(id: string): Thread | null;
  save(thread: Thread): Thread;
}
