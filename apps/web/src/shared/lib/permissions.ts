import { z } from 'zod';

export const permissionSchema = z.enum([
  'view_building',
  'publish_notices',
  'manage_residents',
  'manage_money',
  'manage_fees',
  'manage_condo',
  'view_activity',
]);

export type Permission = z.infer<typeof permissionSchema>;

export const condoRoleSchema = z.enum(['administrador', 'sindico', 'morador']);
export type CondoRole = z.infer<typeof condoRoleSchema>;

export const orgRoleSchema = z.enum(['owner', 'member']);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const ALL_PERMISSIONS: readonly Permission[] = permissionSchema.options;
