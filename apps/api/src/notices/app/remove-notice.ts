import { NoticeNotFoundError } from '../domain/errors';
import type { NoticeRepository } from '../domain/notice-repository';

export async function removeNotice(repo: NoticeRepository, id: string): Promise<void> {
  const existing = await repo.getById(id);
  if (!existing) throw new NoticeNotFoundError(id);
  await repo.remove(id);
}
