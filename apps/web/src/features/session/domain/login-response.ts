import { z } from 'zod';

import { condoRoleSchema, orgRoleSchema, permissionSchema } from '@/shared/lib/permissions';

import { roleSchema } from './session';

export const loginCondoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  role: roleSchema,
  condoRole: condoRoleSchema,
  permissions: z.array(permissionSchema),
  hasHome: z.boolean(),
  organizationId: z.string().min(1),
  orgRole: orgRoleSchema.nullable(),
});

const loginResponseSchema = z.object({
  condos: z.array(loginCondoSchema),
  emailVerified: z.boolean(),
  invitedCondoId: z.string().min(1).nullable().optional(),
});

export type LoginCondo = z.infer<typeof loginCondoSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export function parseLoginResponse(data: unknown): LoginResponse {
  return loginResponseSchema.parse(data);
}
