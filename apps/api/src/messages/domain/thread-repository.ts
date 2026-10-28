import type { Thread } from './message';

export interface ThreadRepository {
  list(viewerUserId: string): Promise<Thread[]>;
  getById(id: string, viewerUserId: string): Promise<Thread | null>;
  save(thread: Thread): Promise<Thread>;
  recordResidentMessage(id: string): Promise<void>;
  markRead(id: string, userId: string): Promise<void>;
}
