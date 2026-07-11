import type { Notice } from '../domain/notice';

export function activeNotices(notices: Notice[]): Notice[] {
  return notices.filter((notice) => !notice.dismissed);
}

export function noticeCount(notices: Notice[]): number {
  return activeNotices(notices).length;
}
