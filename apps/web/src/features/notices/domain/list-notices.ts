import type { Notice } from './notice';
import type { NoticeRepository } from './notice-repository';

export async function listNotices(repository: NoticeRepository): Promise<Notice[]> {
  return repository.list();
}
