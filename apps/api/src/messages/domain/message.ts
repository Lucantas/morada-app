import { z } from 'zod';

export const messageSchema = z.object({
  id: z.string().min(1),
  author: z.enum(['resident', 'admin']),
  text: z.string(),
  dateLabel: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

export const threadSchema = z.object({
  id: z.string().min(1),
  residentName: z.string().min(1),
  apt: z.string().min(1),
  unread: z.boolean(),
  messages: z.array(messageSchema),
});
export type Thread = z.infer<typeof threadSchema>;
