import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

export async function listNotices(repo: NoticeRepository): Promise<Notice[]> {
  return [...(await repo.list())];
}
