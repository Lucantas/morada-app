import { z } from 'zod';

export const accountStatusSchema = z.enum(['pago', 'pendente', 'atrasado']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const accountSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  // The expense date as ISO (YYYY-MM-DD); null only for legacy rows.
  date: z.string().nullable(),
  valueCents: z.number().int().nonnegative(),
  status: accountStatusSchema,
  proofDataUrl: z.string().nullable().optional(),
  hasProof: z.boolean().optional(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = accountSchema.extend({
  id: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida'),
});
export type AccountDraft = z.infer<typeof accountDraftSchema>;
