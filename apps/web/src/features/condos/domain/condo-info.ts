import { z } from 'zod';

export const condoNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do condomínio.')
  .max(80, 'Use até 80 caracteres.');

export const condoInfoSchema = z.object({
  id: z.string().min(1),
  name: condoNameSchema,
});
export type CondoInfo = z.infer<typeof condoInfoSchema>;
