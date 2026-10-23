import { z } from 'zod';

export const condominiumSchema = z.object({
  id: z.string().min(1).max(64),
  organizationId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  active: z.boolean(),
});
export type Condominium = z.infer<typeof condominiumSchema>;

export const condoRoleNameSchema = z.enum(['administrador', 'sindico', 'morador']);
export type CondoRoleName = z.infer<typeof condoRoleNameSchema>;
