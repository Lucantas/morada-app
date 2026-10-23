import { z } from 'zod';

import { roleSchema } from './session';

export const loginCondoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  role: roleSchema,
});

const loginResponseSchema = z.object({
  condos: z.array(loginCondoSchema),
  emailVerified: z.boolean(),
});

export type LoginCondo = z.infer<typeof loginCondoSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export function parseLoginResponse(data: unknown): LoginResponse {
  return loginResponseSchema.parse(data);
}
