import { z } from 'zod';

import { proofSchema } from '../../receipts/domain/proof';
import { isoDateSchema } from '../../shared/domain/iso-date';

export const accountStatusSchema = z.enum(['pago', 'pendente', 'atrasado']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const accountSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  // The date of the expense/lançamento. Nullable only for legacy rows.
  date: isoDateSchema.nullable(),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  status: accountStatusSchema,
  // string = new upload; null = clear; undefined = leave existing proof untouched.
  proofDataUrl: proofSchema.nullable().optional(),
  // Persistence-derived (whether a proof exists), never a write input.
  hasProof: z.boolean().optional(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = accountSchema.extend({
  id: z.string().min(1).optional(),
  date: isoDateSchema,
});
export type AccountDraft = z.infer<typeof accountDraftSchema>;
