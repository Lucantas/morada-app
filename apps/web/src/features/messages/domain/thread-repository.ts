import type { MessageAuthor, Thread } from './message';

export interface ThreadRepository {
  list(): Promise<Thread[]>;
  getById(id: string): Promise<Thread | null>;
  /** Append a message authored by `author`; returns the updated thread. */
  addMessage(threadId: string, author: MessageAuthor, text: string): Promise<Thread>;
  /** Clear the unread flag; returns the updated thread. */
  markRead(threadId: string): Promise<Thread>;
}
