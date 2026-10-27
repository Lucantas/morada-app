import { z } from 'zod';

import { pixSettingsSchema } from './pix-settings';

export const condoSettingsSchema = z.object({
  monthlyFeeCents: z.number().int().min(0),
  dueDay: z.number().int().min(1).max(28),
  pix: pixSettingsSchema.nullable().default(null),
});
export type CondoSettings = z.output<typeof condoSettingsSchema>;
export type CondoSettingsInput = z.input<typeof condoSettingsSchema>;

export type CondoSettingsUpdate = Pick<CondoSettings, 'monthlyFeeCents' | 'dueDay'> & {
  pix?: CondoSettings['pix'];
};
