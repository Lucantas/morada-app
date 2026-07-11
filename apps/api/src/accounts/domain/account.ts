import { z } from 'zod';

export const accountStatusSchema = z.enum(['pago', 'pendente', 'atrasado']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const accountSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  dateLabel: z.string(),
  valueCents: z.number().int(),
  status: accountStatusSchema,
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = accountSchema.extend({ id: z.string().min(1).optional() });
export type AccountDraft = z.infer<typeof accountDraftSchema>;
