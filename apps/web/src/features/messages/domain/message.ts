import { z } from 'zod';

export const messageAuthorSchema = z.enum(['resident', 'admin']);
export type MessageAuthor = z.infer<typeof messageAuthorSchema>;

export const messageSchema = z.object({
  id: z.string().min(1),
  author: messageAuthorSchema,
  text: z.string().min(1),
  dateLabel: z.string().min(1),
});
export type Message = z.infer<typeof messageSchema>;

export const threadSchema = z.object({
  id: z.string().min(1),
  residentName: z.string().min(1),
  apt: z.string().min(1),
  messages: z.array(messageSchema),
  unread: z.boolean(),
});
export type Thread = z.infer<typeof threadSchema>;

export const messageDraftSchema = z.object({
  text: z.string().min(1),
});
export type MessageDraft = z.infer<typeof messageDraftSchema>;
