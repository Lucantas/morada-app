import { z } from 'zod';

export const noticeKindSchema = z.enum(['aviso', 'urgente', 'manutencao']);
export type NoticeKind = z.infer<typeof noticeKindSchema>;

export const noticeSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(2000),
  kind: noticeKindSchema,
  audience: z.string().max(60),
  dateLabel: z.string().max(40),
  dismissed: z.boolean(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticeDraftSchema = noticeSchema.extend({
  id: z.string().min(1).optional(),
  dateLabel: z.string().optional(),
  dismissed: z.boolean().optional(),
});
export type NoticeDraft = z.infer<typeof noticeDraftSchema>;
