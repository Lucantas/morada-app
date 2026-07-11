import { NoticeNotFoundError } from './errors';
import { activeNotices } from './active-notices';
import type { Notice } from './notice';
import type { NoticeRepository } from './notice-repository';

export async function dismissNotice(repository: NoticeRepository, id: string): Promise<Notice> {
  const notice = await repository.getById(id);
  if (!notice) throw new NoticeNotFoundError(id);
  return repository.save({ ...notice, dismissed: true });
}

export async function clearNotices(repository: NoticeRepository): Promise<void> {
  const notices = await repository.list();
  await Promise.all(
    activeNotices(notices).map((notice) => repository.save({ ...notice, dismissed: true })),
  );
}
