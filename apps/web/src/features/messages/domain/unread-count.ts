import type { Thread } from './message';

export function unreadCount(threads: readonly Thread[]): number {
  return threads.filter((thread) => thread.unread === true).length;
}
