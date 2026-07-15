import { z } from 'zod';

export const condoSettingsSchema = z.object({
  monthlyFeeCents: z.number().int().min(0).max(1_000_000_000),
  dueDay: z.number().int().min(1).max(28),
});
export type CondoSettings = z.infer<typeof condoSettingsSchema>;
