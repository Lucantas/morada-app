import { z } from 'zod';

export const accountStatusSchema = z.enum(['pago', 'pendente', 'atrasado']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

// ISO calendar date (YYYY-MM-DD), stored in a DATE column and sortable/reportable.
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)');

export const accountSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  // The date of the expense/lançamento. Nullable only for legacy rows.
  date: isoDateSchema.nullable(),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  status: accountStatusSchema,
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = accountSchema.extend({ id: z.string().min(1).optional() });
export type AccountDraft = z.infer<typeof accountDraftSchema>;
