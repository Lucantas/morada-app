import { randomUUID } from 'node:crypto';

import { NoticeValidationError } from '../domain/errors';
import { noticeDraftSchema, noticeSchema, type Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

export async function createNotice(repo: NoticeRepository, draft: unknown): Promise<Notice> {
  const parsed = noticeDraftSchema.safeParse(draft);
  if (!parsed.success) throw new NoticeValidationError('Dados do aviso inválidos');
  if (!parsed.data.title || !parsed.data.body) {
    throw new NoticeValidationError('Título e mensagem são obrigatórios');
  }
  const notice = noticeSchema.parse({
    ...parsed.data,
    id: parsed.data.id ?? randomUUID(),
    dateLabel: parsed.data.dateLabel ?? 'Agora',
    dismissed: false,
  });
  return repo.save(notice);
}
