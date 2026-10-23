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

export const condoGrantSchema = z
  .object({
    condominiumId: z.string().min(1).max(64),
    userId: z.string().min(1).max(64),
    role: condoRoleNameSchema,
    residentId: z.string().min(1).max(64).nullable(),
  })
  .superRefine((grant, ctx) => {
    if (grant.role === 'morador' && grant.residentId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['residentId'],
        message: 'O papel morador exige um morador vinculado',
      });
    }
    if (grant.role !== 'morador' && grant.residentId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['residentId'],
        message: 'Somente o papel morador pode ter um morador vinculado',
      });
    }
  });
