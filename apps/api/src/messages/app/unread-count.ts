import type { Thread } from '../domain/message';

export function unreadCount(threads: Thread[]): number {
  return threads.filter((thread) => thread.unread === true).length;
}
