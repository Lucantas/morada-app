import type { Thread } from '../messages/domain/message';
import type { ThreadRepository } from '../messages/domain/thread-repository';

export function inMemoryThreads(initial: Thread[]): ThreadRepository {
  let tick = 0;
  const threads = new Map(initial.map((t) => [t.id, { ...t, unread: false }]));
  const residentMessageAt = new Map<string, number>();
  const reads = new Map<string, number>();
  initial.filter((t) => t.unread).forEach((t) => residentMessageAt.set(t.id, ++tick));

  const view = (thread: Thread, viewer: string): Thread => {
    const messageAt = residentMessageAt.get(thread.id);
    const readAt = reads.get(`${thread.id}|${viewer}`);
    const unread = messageAt !== undefined && (readAt === undefined || readAt < messageAt);
    return { ...thread, unread };
  };

  return {
    list: async (viewer) => [...threads.values()].map((t) => view(t, viewer)),
    getById: async (id, viewer) => {
      const thread = threads.get(id);
      return thread ? view(thread, viewer) : null;
    },
    save: async (thread) => {
      threads.set(thread.id, { ...thread, unread: false });
      return thread;
    },
    recordResidentMessage: async (id) => {
      residentMessageAt.set(id, ++tick);
    },
    markRead: async (id, userId) => {
      if (threads.has(id)) reads.set(`${id}|${userId}`, ++tick);
    },
  };
}
