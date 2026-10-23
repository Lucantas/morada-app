import { z } from 'zod';

export const condoNameSchema = z.string().trim().min(1).max(80);

export const condoInfoSchema = z.object({
  id: z.string().min(1),
  name: condoNameSchema,
});
export type CondoInfo = z.infer<typeof condoInfoSchema>;
