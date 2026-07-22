import { z } from 'zod';

export const incomeSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  source: z.string().min(1),
  date: z.string().nullable(),
  valueCents: z.number().int().nonnegative(),
  proofDataUrl: z.string().optional(),
  hasProof: z.boolean().optional(),
});
export type Income = z.infer<typeof incomeSchema>;

export const incomeDraftSchema = incomeSchema.extend({
  id: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida'),
});
export type IncomeDraft = z.infer<typeof incomeDraftSchema>;
