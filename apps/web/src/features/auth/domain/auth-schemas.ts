import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Informe um e-mail válido.')
  .max(160, 'Use até 160 caracteres.');

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(200, 'Use até 200 caracteres.');

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe seu nome.')
  .max(120, 'Use até 120 caracteres.');

export const signUpInputSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpInputSchema>;

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmation: z.string() })
  .refine((input) => input.password === input.confirmation, {
    message: 'As senhas não conferem.',
    path: ['confirmation'],
  });

export const condoNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do condomínio.')
  .max(80, 'Use até 80 caracteres.');

export type Validation<T> = { ok: true; data: T } | { ok: false; message: string };

export function validate<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: unknown,
): Validation<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, message: result.error.issues[0]?.message ?? 'Dados inválidos.' };
}
