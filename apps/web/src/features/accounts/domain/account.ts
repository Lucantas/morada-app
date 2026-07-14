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
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = accountSchema.extend({
  id: z.string().min(1).optional(),
});
export type AccountDraft = z.infer<typeof accountDraftSchema>;
