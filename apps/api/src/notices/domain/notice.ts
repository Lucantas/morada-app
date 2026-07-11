import { z } from 'zod';

export const noticeKindSchema = z.enum(['aviso', 'urgente', 'manutencao']);
export type NoticeKind = z.infer<typeof noticeKindSchema>;

export const noticeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  kind: noticeKindSchema,
  audience: z.string(),
  dateLabel: z.string(),
  dismissed: z.boolean(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticeDraftSchema = noticeSchema.extend({
  id: z.string().min(1).optional(),
  dateLabel: z.string().optional(),
  dismissed: z.boolean().optional(),
});
export type NoticeDraft = z.infer<typeof noticeDraftSchema>;
