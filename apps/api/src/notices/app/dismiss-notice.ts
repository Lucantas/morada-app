import { NoticeNotFoundError } from '../domain/errors';
import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

export async function dismissNotice(repo: NoticeRepository, id: string): Promise<Notice> {
  const notice = await repo.getById(id);
  if (!notice) throw new NoticeNotFoundError(id);
  return repo.save({ ...notice, dismissed: true });
}
