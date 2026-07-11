import { NoticeValidationError } from './errors';
import { noticeDraftSchema, noticeSchema, type Notice, type NoticeDraft } from './notice';
import type { NoticeRepository } from './notice-repository';

export async function createNotice(
  repository: NoticeRepository,
  draft: NoticeDraft,
): Promise<Notice> {
  const parsedDraft = noticeDraftSchema.safeParse(draft);
  if (!parsedDraft.success) {
    throw new NoticeValidationError('Dados do aviso inválidos');
  }
  const notice = noticeSchema.parse({
    ...parsedDraft.data,
    id: crypto.randomUUID(),
    dateLabel: parsedDraft.data.dateLabel ?? 'Agora',
    dismissed: false,
  });
  return repository.save(notice);
}
