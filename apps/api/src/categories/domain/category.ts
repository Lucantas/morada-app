import { z } from 'zod';

export const categorySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  keywords: z.string().max(400),
  position: z.number().int().min(0),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryDraftSchema = categorySchema.extend({
  id: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
});
export type CategoryDraft = z.infer<typeof categoryDraftSchema>;
