import { z } from 'zod';

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  keywords: z.string(),
  position: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;

export type CategoryDraft = { id?: string; name: string; keywords: string };
