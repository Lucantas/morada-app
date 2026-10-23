import { z } from 'zod';

import { roleSchema } from './session';

const loginResponseSchema = z.object({
  condos: z.array(z.object({ id: z.string().min(1), name: z.string(), role: roleSchema })).min(1),
});

export type LoginCondo = z.infer<typeof loginResponseSchema>['condos'][number];

export function parseLoginResponse(data: unknown): LoginCondo[] {
  return loginResponseSchema.parse(data).condos;
}
