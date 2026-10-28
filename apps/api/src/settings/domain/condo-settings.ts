import { z } from 'zod';

import { isoDateSchema } from '../../shared/domain/iso-date';

import { pixSettingsSchema } from './pix-key';

export const openingBalanceSchema = z.object({
  valueCents: z.number().int().min(0).max(1_000_000_000),
  date: isoDateSchema,
});
export type OpeningBalance = z.infer<typeof openingBalanceSchema>;

export const condoSettingsSchema = z.object({
  monthlyFeeCents: z.number().int().min(0).max(1_000_000_000),
  dueDay: z.number().int().min(1).max(28),
  pix: pixSettingsSchema.nullable().default(null),
  openingBalance: openingBalanceSchema.nullable().default(null),
});
export type CondoSettings = z.infer<typeof condoSettingsSchema>;
