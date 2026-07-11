import { z } from 'zod';

export const accountStatusSchema = z.enum(['pago', 'pendente', 'atrasado']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const accountSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  dateLabel: z.string().max(40),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  status: accountStatusSchema,
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = accountSchema.extend({ id: z.string().min(1).optional() });
export type AccountDraft = z.infer<typeof accountDraftSchema>;
