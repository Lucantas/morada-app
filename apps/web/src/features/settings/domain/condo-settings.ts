import { z } from 'zod';

import { pixSettingsSchema } from './pix-settings';

export const MAX_OPENING_BALANCE_CENTS = 1_000_000_000;

export const openingBalanceSchema = z.object({
  valueCents: z.number().int().min(0).max(MAX_OPENING_BALANCE_CENTS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type OpeningBalance = z.output<typeof openingBalanceSchema>;

export const condoSettingsSchema = z.object({
  monthlyFeeCents: z.number().int().min(0),
  dueDay: z.number().int().min(1).max(28),
  pix: pixSettingsSchema.nullable().default(null),
  openingBalance: openingBalanceSchema.nullable().default(null),
});
export type CondoSettings = z.output<typeof condoSettingsSchema>;
export type CondoSettingsInput = z.input<typeof condoSettingsSchema>;

export type CondoSettingsUpdate = Pick<CondoSettings, 'monthlyFeeCents' | 'dueDay'> & {
  pix?: CondoSettings['pix'];
  openingBalance?: CondoSettings['openingBalance'];
};
