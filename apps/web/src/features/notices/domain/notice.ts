import { z } from 'zod';

export const noticeKindSchema = z.enum(['aviso', 'urgente', 'manutencao']);
export type NoticeKind = z.infer<typeof noticeKindSchema>;

export const noticeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  kind: noticeKindSchema,
  audience: z.string().min(1),
  dateLabel: z.string().min(1),
  dismissed: z.boolean(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticeDraftSchema = noticeSchema.extend({
  id: z.string().min(1).optional(),
  dismissed: z.boolean().optional(),
  dateLabel: z.string().min(1).optional(),
});
export type NoticeDraft = z.infer<typeof noticeDraftSchema>;
