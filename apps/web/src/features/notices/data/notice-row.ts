import { noticeSchema, type Notice } from '../domain/notice';

export function toNotice(raw: unknown): Notice {
  return noticeSchema.parse(raw);
}
