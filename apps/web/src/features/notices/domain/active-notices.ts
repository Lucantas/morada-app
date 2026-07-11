import type { Notice } from './notice';

export function activeNotices(notices: readonly Notice[]): Notice[] {
  return notices.filter((notice) => notice.dismissed === false);
}

export function noticeCount(notices: readonly Notice[]): number {
  return activeNotices(notices).length;
}
