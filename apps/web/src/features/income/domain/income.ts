import { z } from 'zod';

export const incomeSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  source: z.string().min(1),
  date: z.string().nullable(),
  valueCents: z.number().int().nonnegative(),
  proofDataUrl: z.string().optional(),
});
export type Income = z.infer<typeof incomeSchema>;

export const incomeDraftSchema = incomeSchema.extend({
  id: z.string().min(1).optional(),
});
export type IncomeDraft = z.infer<typeof incomeDraftSchema>;
