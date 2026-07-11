import { ThreadNotFoundError } from '../domain/errors';
import type { MessageAuthor, Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

import { toThread } from './thread-row';

export class InMemoryThreadRepository implements ThreadRepository {
  private threads: Map<string, Thread>;

  constructor(seed: readonly unknown[] = []) {
    this.threads = new Map(seed.map((raw) => toThread(raw)).map((t) => [t.id, t]));
  }

  async list(): Promise<Thread[]> {
    return [...this.threads.values()];
  }

  async getById(id: string): Promise<Thread | null> {
    return this.threads.get(id) ?? null;
  }

  async addMessage(threadId: string, author: MessageAuthor, text: string): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new ThreadNotFoundError(threadId);
    const next: Thread = {
      ...thread,
      messages: [...thread.messages, { id: crypto.randomUUID(), author, text, dateLabel: 'Agora' }],
      unread: author === 'resident',
    };
    this.threads = new Map(this.threads).set(threadId, next);
    return next;
  }

  async markRead(threadId: string): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new ThreadNotFoundError(threadId);
    const next: Thread = { ...thread, unread: false };
    this.threads = new Map(this.threads).set(threadId, next);
    return next;
  }
}
