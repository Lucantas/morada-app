import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

export function listNotices(repo: NoticeRepository): Notice[] {
  return [...repo.list()];
}
