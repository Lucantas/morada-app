import type { Thread } from './message';

export interface ThreadRepository {
  list(): Promise<Thread[]>;
  getById(id: string): Promise<Thread | null>;
  save(thread: Thread): Promise<Thread>;
}
