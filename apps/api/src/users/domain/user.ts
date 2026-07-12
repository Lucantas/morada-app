import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'resident']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(
    /^[a-z0-9._-]+$/,
    'Usuário deve conter apenas letras minúsculas, números, ponto, hífen ou _',
  );

export const userSchema = z.object({
  id: z.string().min(1).max(64),
  username: usernameSchema,
  passwordHash: z.string().min(1),
  role: userRoleSchema,
  residentId: z.string().min(1).max(64).nullable(),
});
export type User = z.infer<typeof userSchema>;
