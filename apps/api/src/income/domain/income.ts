import { z } from 'zod';

import { proofSchema } from '../../receipts/domain/proof';
import { isoDateSchema } from '../../shared/domain/iso-date';

export const incomeSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(200),
  source: z.string().min(1).max(120),
  date: isoDateSchema.nullable(),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  proofDataUrl: proofSchema.optional(),
});
export type Income = z.infer<typeof incomeSchema>;

export const incomeDraftSchema = incomeSchema.extend({ id: z.string().min(1).optional() });
export type IncomeDraft = z.infer<typeof incomeDraftSchema>;
