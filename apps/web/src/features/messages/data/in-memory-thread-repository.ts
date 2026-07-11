import type { Thread } from '../domain/message';
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

  async save(thread: Thread): Promise<Thread> {
    this.threads = new Map(this.threads).set(thread.id, thread);
    return thread;
  }
}
